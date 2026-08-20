import crypto from 'crypto';
import { BulkSession, IBulkSession } from '../../../models/bulkSession.model';
import { BulkParticipant, IBulkParticipant } from '../../../models/bulkParticipant.model';
import { env } from '../../../config/env';
import { logger } from '../../../utils/logger';

export class BulkService {
  private static instance: BulkService;

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
      const existing = await BulkSession.findOne({ bulkCode: numericCode, status: { $in: ['CREATING', 'ACTIVE'] } });
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
      await BulkSession.updateMany(
        { hostSocketId, status: 'ACTIVE' },
        { status: 'CLOSED', closedAt: new Date() }
      ).catch(() => null);
    }

    const sessionId = `bulk_${crypto.randomBytes(12).toString('hex')}`;
    const bulkCode = await this.generateUniqueBulkCode();

    const session = await BulkSession.create({
      sessionId,
      bulkCode,
      status: 'ACTIVE',
      hostSocketId: hostSocketId || undefined,
      lastHostHeartbeat: new Date(),
      participantCount: 0,
      maxParticipants: env.MAX_BULK_PARTICIPANTS || 50,
      settings: {
        autoVerify: env.AUTO_VERIFY,
        requireHostVerification: !env.AUTO_VERIFY,
      },
    });

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
    const session = await BulkSession.findOne({
      $or: [{ bulkCode: normalized }, { sessionId: normalized }],
      status: 'ACTIVE',
    });

    if (!session) return null;

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

    const participant = await BulkParticipant.create({
      participantId,
      sessionId: session.sessionId,
      displayName: sanitizedName,
      socketId: socketId || undefined,
      status: 'CONNECTED',
    });

    session.participantCount += 1;
    await session.save();

    logger.info(`👤 Student '${sanitizedName}' joined Bulk Session ${session.sessionId}`);
    return { session, participant };
  }

  /**
   * Updates host heartbeat.
   */
  public async updateHeartbeat(sessionId: string, hostSocketId?: string): Promise<boolean> {
    const session = await BulkSession.findOne({ sessionId, status: 'ACTIVE' });
    if (!session) return false;

    session.lastHostHeartbeat = new Date();
    if (hostSocketId) {
      session.hostSocketId = hostSocketId;
    }
    await session.save();
    return true;
  }

  /**
   * Closes a Bulk Session and cleans up.
   */
  public async closeSession(sessionId: string, reason = 'Host ended session'): Promise<IBulkSession | null> {
    const session = await BulkSession.findOne({ sessionId, status: { $ne: 'CLOSED' } });
    if (!session) return null;

    session.status = 'CLOSED';
    session.closedAt = new Date();
    await session.save();

    await BulkParticipant.updateMany({ sessionId }, { status: 'LEFT' });
    logger.info(`📦 Bulk Session Closed: ${sessionId} (${reason})`);

    return session;
  }

  /**
   * Scans and closes stale sessions whose host heartbeat has timed out.
   */
  public async checkStaleSessions(): Promise<string[]> {
    const timeoutMs = env.BULK_HOST_TIMEOUT || 15000;
    const cutoff = new Date(Date.now() - timeoutMs);

    const staleSessions = await BulkSession.find({
      status: 'ACTIVE',
      lastHostHeartbeat: { $lt: cutoff },
    });

    const closedIds: string[] = [];
    for (const session of staleSessions) {
      await this.closeSession(session.sessionId, 'Host heartbeat timeout');
      closedIds.push(session.sessionId);
    }

    return closedIds;
  }
}

export const bulkService = BulkService.getInstance();
