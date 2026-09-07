import crypto from 'crypto';
import { prisma } from '../../../config/prisma';
import { BulkSession, BulkParticipant, BulkSessionStatus, BulkParticipantStatus } from '@prisma/client';
import { IBulkSession, BulkSessionStatus as BulkSessionStatusType } from '../../../models/bulkSession.model';
import { IBulkParticipant } from '../../../models/bulkParticipant.model';
import { env } from '../../../config/env';
import { logger } from '../../../utils/logger';

function mapBulkSession(record: BulkSession): IBulkSession {
  return {
    _id: record.id,
    id: record.id,
    sessionId: record.sessionId,
    bulkCode: record.bulkCode,
    status: record.status as BulkSessionStatusType,
    hostSocketId: record.hostSocketId ?? undefined,
    lastHostHeartbeat: record.lastHostHeartbeat,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    closedAt: record.closedAt ?? undefined,
    participantCount: record.participantCount,
    maxParticipants: record.maxParticipants,
    settings: record.settings as unknown as {
      autoVerify: boolean;
      requireHostVerification: boolean;
      verificationCode?: string;
    },
  };
}

function mapBulkParticipant(record: BulkParticipant): IBulkParticipant {
  return {
    _id: record.id,
    id: record.id,
    participantId: record.participantId,
    sessionId: record.sessionId,
    displayName: record.displayName,
    socketId: record.socketId ?? undefined,
    joinedAt: record.joinedAt,
    lastSeenAt: record.lastSeenAt,
    status: record.status as 'CONNECTED' | 'DISCONNECTED' | 'LEFT',
    filesUploaded: record.filesUploaded,
    totalBytesUploaded: Number(record.totalBytesUploaded), // Safely cast BigInt to Number
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export class BulkService {
  private static instance: BulkService;
  private isCheckingStale: boolean = false;

  private constructor() {}

  public static getInstance(): BulkService {
    if (!BulkService.instance) {
      BulkService.instance = new BulkService();
    }
    return BulkService.instance;
  }

  /**
   * Generates a cryptographically random 9-digit numeric Bulk Code.
   */
  public async generateUniqueBulkCode(): Promise<string> {
    const maxRetries = 10;
    for (let i = 0; i < maxRetries; i++) {
      const numericCode = crypto.randomInt(100000000, 1000000000).toString();
      const existing = await prisma.bulkSession.findFirst({
        where: {
          bulkCode: numericCode,
          status: { in: [BulkSessionStatus.CREATING, BulkSessionStatus.ACTIVE] },
        },
      });
      if (!existing) {
        return numericCode;
      }
    }
    throw new Error('Failed to generate a unique Bulk Code. Please try again.');
  }

  /**
   * Creates a new Bulk Session for host.
   */
  public async createBulkSession(hostSocketId?: string, clientOrigin?: string): Promise<{
    session: IBulkSession;
    shareUrl: string;
  }> {
    // Enforce tenant/session isolation: Close any previous active sessions for this host socket
    if (hostSocketId) {
      await prisma.bulkSession.updateMany({
        where: { hostSocketId, status: BulkSessionStatus.ACTIVE },
        data: { status: BulkSessionStatus.CLOSED, closedAt: new Date() },
      }).catch(() => null);
    }

    const sessionId = `bulk_${crypto.randomBytes(12).toString('hex')}`;
    const bulkCode = await this.generateUniqueBulkCode();

    const created = await prisma.bulkSession.create({
      data: {
        sessionId,
        bulkCode,
        status: BulkSessionStatus.ACTIVE,
        hostSocketId: hostSocketId || null,
        lastHostHeartbeat: new Date(),
        participantCount: 0,
        maxParticipants: env.MAX_BULK_PARTICIPANTS || 50,
        settings: {
          autoVerify: env.AUTO_VERIFY,
          requireHostVerification: !env.AUTO_VERIFY,
        },
      },
    });

    const session = mapBulkSession(created);

    let baseClientUrl = env.CLIENT_URL;
    if (clientOrigin) {
      try {
        const parsed = new URL(clientOrigin);
        baseClientUrl = `${parsed.protocol}//${parsed.host}`;
      } catch {
        baseClientUrl = clientOrigin.replace(/\/+$/, '');
      }
    }

    const shareUrl = `${baseClientUrl}/bulk?code=${bulkCode}`;
    logger.info(`📦 Bulk Session Created: ${sessionId} (Code: ${bulkCode}, URL: ${shareUrl})`);

    return { session, shareUrl };
  }

  /**
   * Gets active session details by 9-digit Bulk Code or sessionId.
   */
  public async getSessionByCode(codeOrId: string): Promise<IBulkSession | null> {
    const normalized = codeOrId.replace(/\s+/g, '').replace(/-/g, '').trim();
    const sessionRecord = await prisma.bulkSession.findFirst({
      where: {
        OR: [{ bulkCode: normalized }, { sessionId: normalized }],
        status: BulkSessionStatus.ACTIVE,
      },
    });

    if (!sessionRecord) return null;

    const session = mapBulkSession(sessionRecord);

    // Verify host heartbeat freshness (must have heartbeat within last 15 seconds)
    const timeoutMs = env.BULK_HOST_TIMEOUT || 15000;
    const cutoff = new Date(Date.now() - timeoutMs);
    if (session.lastHostHeartbeat && session.lastHostHeartbeat < cutoff) {
      logger.info(`⏳ Stale session detected for code ${session.bulkCode}. Closing session.`);
      await this.closeSession(session.sessionId, 'Host heartbeat timeout');
      return null;
    }

    return session;
  }

  /**
   * Student joins a Bulk Session.
   */
  public async joinBulkSession(
    codeOrId: string,
    displayName: string,
    socketId?: string
  ): Promise<{
    session: IBulkSession;
    participant: IBulkParticipant;
  }> {
    const session = await this.getSessionByCode(codeOrId);
    if (!session) {
      throw new Error('Bulk session not found or has ended');
    }

    if (session.status !== 'ACTIVE') {
      throw new Error('Bulk session is no longer active');
    }

    const sanitizedName = displayName.trim().substring(0, env.MAX_DISPLAY_NAME_LENGTH || 40);
    if (!sanitizedName) {
      throw new Error('Valid display name is required');
    }

    const participantId = `part_${crypto.randomBytes(8).toString('hex')}`;

    const createdParticipant = await prisma.bulkParticipant.create({
      data: {
        participantId,
        sessionId: session.sessionId,
        displayName: sanitizedName,
        socketId: socketId || null,
        status: BulkParticipantStatus.CONNECTED,
      },
    });

    const updatedSessionRecord = await prisma.bulkSession.update({
      where: { sessionId: session.sessionId },
      data: { participantCount: { increment: 1 } },
    });

    const updatedSession = mapBulkSession(updatedSessionRecord);
    const participant = mapBulkParticipant(createdParticipant);

    logger.info(`👤 Student '${sanitizedName}' joined Bulk Session ${session.sessionId}`);
    return { session: updatedSession, participant };
  }

  /**
   * Updates host heartbeat.
   */
  public async updateHeartbeat(sessionId: string, hostSocketId?: string): Promise<boolean> {
    const session = await prisma.bulkSession.findFirst({
      where: { sessionId, status: BulkSessionStatus.ACTIVE },
    });
    if (!session) return false;

    await prisma.bulkSession.update({
      where: { id: session.id },
      data: {
        lastHostHeartbeat: new Date(),
        ...(hostSocketId ? { hostSocketId } : {}),
      },
    });
    return true;
  }

  /**
   * Closes a Bulk Session and cleans up.
   */
  public async closeSession(sessionId: string, reason = 'Host ended session'): Promise<IBulkSession | null> {
    const session = await prisma.bulkSession.findFirst({
      where: { sessionId, status: { not: BulkSessionStatus.CLOSED } },
    });
    if (!session) return null;

    const closedRecord = await prisma.bulkSession.update({
      where: { id: session.id },
      data: {
        status: BulkSessionStatus.CLOSED,
        closedAt: new Date(),
      },
    });

    await prisma.bulkParticipant.updateMany({
      where: { sessionId },
      data: { status: BulkParticipantStatus.LEFT },
    });

    logger.info(`📦 Bulk Session Closed: ${sessionId} (${reason})`);
    return mapBulkSession(closedRecord);
  }

  /**
   * Scans and closes stale sessions whose host heartbeat has timed out.
   */
  public async checkStaleSessions(): Promise<string[]> {
    if (this.isCheckingStale) {
      return [];
    }

    this.isCheckingStale = true;
    try {
      const timeoutMs = env.BULK_HOST_TIMEOUT || 15000;
      const cutoff = new Date(Date.now() - timeoutMs);

      const staleSessions = await prisma.bulkSession.findMany({
        where: {
          status: BulkSessionStatus.ACTIVE,
          lastHostHeartbeat: { lt: cutoff },
        },
      });

      const closedIds: string[] = [];
      for (const session of staleSessions) {
        await this.closeSession(session.sessionId, 'Host heartbeat timeout');
        closedIds.push(session.sessionId);
      }

      return closedIds;
    } finally {
      this.isCheckingStale = false;
    }
  }
}

export const bulkService = BulkService.getInstance();
