import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Namespace, Socket } from 'socket.io';
import { allowedOrigins, isOriginAllowed } from '../config/cors';
import { logger } from '../utils/logger';
import {
  SocketStatusEvent,
  SocketProgressPayload,
  JoinRoomData,
  RoomJoinedPayload,
} from '../types/socket.types';

export class SocketService {
  private static instance: SocketService;
  private io: SocketIOServer | null = null;
  private socketNamespace: Namespace | null = null;
  private hostSessions: Map<string, string> = new Map();
  private studentSessions: Map<string, { sessionId: string; participantId: string; displayName: string }> = new Map();

  private constructor() {}

  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  /**
   * Initializes Socket.IO server and binds to /socket namespace.
   */
  public init(httpServer: HttpServer): SocketIOServer {
    if (this.io) {
      logger.info('⚡ Socket.IO already initialized');
      return this.io;
    }

    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: (origin, callback) => {
          if (isOriginAllowed(origin)) {
            callback(null, true);
          } else {
            callback(null, false);
          }
        },
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    // Dedicated /socket namespace
    this.socketNamespace = this.io.of('/socket');
    this.setupListeners();

    // Start periodic background cleanup for stale bulk sessions (every 10s)
    setInterval(async () => {
      try {
        const { bulkService } = await import('../modules/bulk/services/bulk.service');
        await bulkService.checkStaleSessions();
      } catch (err) {
        // ignore
      }
    }, 10000);

    logger.info('⚡ Socket.IO initialized on /socket namespace');
    return this.io;
  }

  private setupListeners(): void {
    if (!this.socketNamespace) return;

    this.socketNamespace.on('connection', (socket: Socket) => {
      logger.info(`🔌 Socket Connected: ${socket.id} on /socket namespace`);

      // Handle joining transfer room (supports join-transfer-room and legacy join-transfer)
      const handleJoinRoom = async (data: JoinRoomData) => {
        const rawKey = data?.roomKey || data?.transferToken || data?.shareId;
        if (!rawKey || typeof rawKey !== 'string') {
          socket.emit('error', { message: 'Invalid room key or transfer token provided' });
          return;
        }

        const roomKey = rawKey.trim();
        const primaryRoom = roomKey.startsWith('transfer:') ? roomKey : `transfer:${roomKey}`;

        socket.join(primaryRoom);
        socket.join(roomKey); // Join raw key alias as well

        logger.info(`🔌 Room Joined: Socket ${socket.id} -> ${primaryRoom}`);

        let currentStatus: unknown = null;
        try {
          // Dynamic import to avoid circular dependency during bootstrap
          const { transferService } = await import('../modules/transfer/services/transfer.service');
          const cleanToken = roomKey.replace(/^transfer:/, '');
          currentStatus = await transferService.getTransferStatus(cleanToken).catch(() => null);
        } catch {
          // Status fetch is optional for state recovery
        }

        const confirmation: RoomJoinedPayload = {
          roomKey: primaryRoom,
          status: 'success',
          timestamp: new Date().toISOString(),
          currentStatus,
        };

        socket.emit('joined-room', confirmation);

        // If transfer status was recovered on reconnect, push current state immediately
        if (currentStatus) {
          socket.emit('transfer-status', currentStatus);
        }
      };

      socket.on('join-transfer-room', handleJoinRoom);
      socket.on('join-transfer', handleJoinRoom);

      // Handle leaving transfer room
      const handleLeaveRoom = (data: JoinRoomData) => {
        const rawKey = data?.roomKey || data?.transferToken || data?.shareId;
        if (!rawKey || typeof rawKey !== 'string') return;

        const roomKey = rawKey.trim();
        const primaryRoom = roomKey.startsWith('transfer:') ? roomKey : `transfer:${roomKey}`;

        socket.leave(primaryRoom);
        socket.leave(roomKey);

        logger.info(`🔌 Room Left: Socket ${socket.id} <- ${primaryRoom}`);
      };

      socket.on('leave-transfer-room', handleLeaveRoom);
      socket.on('leave-transfer', handleLeaveRoom);

      // Track Host sockets for automatic cleanup on disconnect
      socket.on('bulk-host-register', async (data: { sessionId: string }) => {
        if (!data?.sessionId) return;
        const bulkRoom = `bulk:${data.sessionId}`;
        socket.join(bulkRoom);
        socket.join(data.sessionId);

        const prevSessionId = this.hostSessions.get(socket.id);
        if (prevSessionId && prevSessionId !== data.sessionId) {
          const { bulkService } = await import('../modules/bulk/services/bulk.service');
          await bulkService.closeSession(prevSessionId, 'Host registered new session').catch(() => null);
        }

        this.hostSessions.set(socket.id, data.sessionId);
        logger.info(`📦 Bulk Host Registered: Socket ${socket.id} -> ${bulkRoom}`);
      });

      socket.on('bulk-host-heartbeat', async (data: { sessionId: string }) => {
        if (!data?.sessionId) return;
        const { bulkService } = await import('../modules/bulk/services/bulk.service');
        await bulkService.updateHeartbeat(data.sessionId, socket.id).catch(() => null);
      });

      // Handle student joining bulk room
      socket.on('bulk-student-join', (data: { sessionId: string; displayName: string; participantId: string }) => {
        if (!data?.sessionId) return;
        const bulkRoom = `bulk:${data.sessionId}`;
        socket.join(bulkRoom);
        socket.join(data.sessionId);
        this.studentSessions.set(socket.id, {
          sessionId: data.sessionId,
          participantId: data.participantId,
          displayName: data.displayName,
        });
        logger.info(`👤 Bulk Student Joined Socket Room: ${data.displayName} (${socket.id}) -> ${bulkRoom}`);
        socket.to(bulkRoom).emit('bulk-student-joined', {
          socketId: socket.id,
          displayName: data.displayName,
          participantId: data.participantId,
          timestamp: new Date().toISOString(),
        });
      });

      // Normal WebRTC P2P Signaling
      socket.on('webrtc-offer', (data: { roomKey: string; offer: unknown }) => {
        if (!data?.roomKey || !data?.offer) return;
        const primaryRoom = data.roomKey.startsWith('transfer:') ? data.roomKey : `transfer:${data.roomKey}`;
        socket.to(primaryRoom).to(data.roomKey).emit('webrtc-offer', {
          senderSocketId: socket.id,
          offer: data.offer,
        });
      });

      socket.on('webrtc-answer', (data: { roomKey: string; answer: unknown }) => {
        if (!data?.roomKey || !data?.answer) return;
        const primaryRoom = data.roomKey.startsWith('transfer:') ? data.roomKey : `transfer:${data.roomKey}`;
        socket.to(primaryRoom).to(data.roomKey).emit('webrtc-answer', {
          senderSocketId: socket.id,
          answer: data.answer,
        });
      });

      socket.on('webrtc-ice-candidate', (data: { roomKey: string; candidate: unknown }) => {
        if (!data?.roomKey || !data?.candidate) return;
        const primaryRoom = data.roomKey.startsWith('transfer:') ? data.roomKey : `transfer:${data.roomKey}`;
        socket.to(primaryRoom).to(data.roomKey).emit('webrtc-ice-candidate', {
          senderSocketId: socket.id,
          candidate: data.candidate,
        });
      });

      socket.on('pairing-required', (data: { roomKey: string; verificationCode?: string }) => {
        if (!data?.roomKey) return;
        const primaryRoom = data.roomKey.startsWith('transfer:') ? data.roomKey : `transfer:${data.roomKey}`;
        socket.to(primaryRoom).to(data.roomKey).emit('pairing-required', {
          senderSocketId: socket.id,
          verificationCode: data.verificationCode,
        });
      });

      socket.on('pairing-verified', (data: { roomKey: string }) => {
        if (!data?.roomKey) return;
        const primaryRoom = data.roomKey.startsWith('transfer:') ? data.roomKey : `transfer:${data.roomKey}`;
        socket.to(primaryRoom).to(data.roomKey).emit('pairing-verified', {
          senderSocketId: socket.id,
        });
      });

      socket.on('webrtc-connection-state', (data: { roomKey: string; state: string }) => {
        if (!data?.roomKey) return;
        const primaryRoom = data.roomKey.startsWith('transfer:') ? data.roomKey : `transfer:${data.roomKey}`;
        socket.to(primaryRoom).to(data.roomKey).emit('webrtc-connection-state', {
          senderSocketId: socket.id,
          state: data.state,
        });
      });

      // Bulk Transfer WebRTC & Session Event Relays
      socket.on('bulk-webrtc-offer', (data: { sessionId: string; targetSocketId?: string; offer: unknown; studentName?: string; participantId?: string }) => {
        const bulkRoom = `bulk:${data.sessionId}`;
        if (data.targetSocketId) {
          this.socketNamespace?.to(data.targetSocketId).emit('bulk-webrtc-offer', {
            senderSocketId: socket.id,
            offer: data.offer,
            studentName: data.studentName,
            participantId: data.participantId,
          });
        } else {
          socket.to(bulkRoom).emit('bulk-webrtc-offer', {
            senderSocketId: socket.id,
            offer: data.offer,
            studentName: data.studentName,
            participantId: data.participantId,
          });
        }
      });

      socket.on('bulk-webrtc-answer', (data: { sessionId: string; targetSocketId: string; answer: unknown }) => {
        if (data.targetSocketId && this.socketNamespace) {
          this.socketNamespace.to(data.targetSocketId).emit('bulk-webrtc-answer', {
            senderSocketId: socket.id,
            answer: data.answer,
          });
        }
      });

      socket.on('bulk-webrtc-ice-candidate', (data: { sessionId: string; targetSocketId?: string; candidate: unknown }) => {
        const bulkRoom = `bulk:${data.sessionId}`;
        if (data.targetSocketId && this.socketNamespace) {
          this.socketNamespace.to(data.targetSocketId).emit('bulk-webrtc-ice-candidate', {
            senderSocketId: socket.id,
            candidate: data.candidate,
          });
        } else {
          socket.to(bulkRoom).emit('bulk-webrtc-ice-candidate', {
            senderSocketId: socket.id,
            candidate: data.candidate,
          });
        }
      });

      socket.on('bulk-upload-started', (data: { sessionId: string; participantId: string; fileId: string; fileName: string; size: number }) => {
        const bulkRoom = `bulk:${data.sessionId}`;
        socket.to(bulkRoom).emit('bulk-upload-started', data);
      });

      socket.on('bulk-upload-progress', (data: { sessionId: string; participantId: string; fileId: string; percentage: number }) => {
        const bulkRoom = `bulk:${data.sessionId}`;
        socket.to(bulkRoom).emit('bulk-upload-progress', data);
      });

      socket.on('bulk-file-completed', (data: { sessionId: string; participantId: string; fileId: string; fileName: string; size: number }) => {
        const bulkRoom = `bulk:${data.sessionId}`;
        socket.to(bulkRoom).emit('bulk-file-completed', data);
      });

      socket.on('bulk-file-deleted', (data: { sessionId: string; fileId: string }) => {
        const bulkRoom = `bulk:${data.sessionId}`;
        socket.to(bulkRoom).emit('bulk-file-deleted', data);
      });

      socket.on('bulk-all-files-deleted', (data: { sessionId: string }) => {
        const bulkRoom = `bulk:${data.sessionId}`;
        socket.to(bulkRoom).emit('bulk-all-files-deleted', data);
      });

      socket.on('bulk-end-session', async (data: { sessionId: string }) => {
        if (!data?.sessionId) return;
        const bulkRoom = `bulk:${data.sessionId}`;
        const { bulkService } = await import('../modules/bulk/services/bulk.service');
        await bulkService.closeSession(data.sessionId, 'Host ended session').catch(() => null);
        if (this.socketNamespace) {
          this.socketNamespace.to(bulkRoom).to(data.sessionId).emit('bulk-session-ended', {
            sessionId: data.sessionId,
            message: 'The host has ended the bulk transfer session.',
          });
        }
      });

      socket.on('disconnect', async (reason: string) => {
        logger.info(`🔌 Socket Disconnected: ${socket.id} (${reason})`);

        // Check if disconnected socket is a Bulk Student
        if (this.studentSessions.has(socket.id)) {
          const studentInfo = this.studentSessions.get(socket.id)!;
          this.studentSessions.delete(socket.id);
          const bulkRoom = `bulk:${studentInfo.sessionId}`;
          if (this.socketNamespace) {
            this.socketNamespace.to(bulkRoom).emit('bulk-student-left', {
              socketId: socket.id,
              participantId: studentInfo.participantId,
              displayName: studentInfo.displayName,
              sessionId: studentInfo.sessionId,
              timestamp: new Date().toISOString(),
            });
          }
        }

        // Check if disconnected socket is a Bulk Host
        if (this.hostSessions.has(socket.id)) {
          const sessionId = this.hostSessions.get(socket.id)!;
          this.hostSessions.delete(socket.id);
          const bulkRoom = `bulk:${sessionId}`;
          const { bulkService } = await import('../modules/bulk/services/bulk.service');
          await bulkService.closeSession(sessionId, 'Host socket disconnected').catch(() => null);
          if (this.socketNamespace) {
            this.socketNamespace.to(bulkRoom).to(sessionId).emit('bulk-session-ended', {
              sessionId,
              message: 'The host has closed the session or lost connection.',
            });
          }
        }
      });
    });
  }

  public getIO(): SocketIOServer {
    if (!this.io) {
      throw new Error('Socket.IO is not initialized!');
    }
    return this.io;
  }

  public getNamespace(): Namespace {
    if (!this.socketNamespace) {
      throw new Error('Socket.IO /socket namespace is not initialized!');
    }
    return this.socketNamespace;
  }

  /**
   * Helper to format standardized event progress payloads.
   */
  public buildPayload(
    status: SocketStatusEvent | string,
    percentage?: number,
    message?: string,
    transferToken?: string,
    shareId?: string,
    data?: unknown
  ): SocketProgressPayload {
    return {
      transferToken,
      shareId,
      status,
      percentage,
      message,
      timestamp: new Date().toISOString(),
      data,
    };
  }

  /**
   * Emits event strictly to sockets joined to the target transfer room. Never broadcasts globally.
   */
  public emitToRoom(roomKey: string, event: string, payload: unknown): void {
    if (!roomKey) return;
    try {
      if (this.socketNamespace) {
        const primaryRoom = roomKey.startsWith('transfer:') ? roomKey : `transfer:${roomKey}`;
        this.socketNamespace.to(primaryRoom).to(roomKey).emit(event, payload);
        logger.debug(`Events Emitted: '${event}' -> Room '${primaryRoom}'`);
      }
    } catch (err) {
      logger.warn(`⚠️ Failed to emit socket event '${event}' to room '${roomKey}':`, err);
    }
  }

  // Lifecycle Emitter Helpers
  public emitTransferCreated(roomKey: string, data: unknown): void {
    const payload = this.buildPayload('transfer-created', 0, 'Transfer created', undefined, undefined, data);
    this.emitToRoom(roomKey, 'transfer-created', payload);
  }

  public emitUploadStarted(roomKey: string, data?: unknown): void {
    const payload = this.buildPayload('upload-started', 0, 'Upload started', undefined, undefined, data);
    this.emitToRoom(roomKey, 'upload-started', payload);
  }

  public emitUploadProgress(roomKey: string, percentage: number, message = 'Uploading files...'): void {
    const payload = this.buildPayload('upload-progress', percentage, message);
    this.emitToRoom(roomKey, 'upload-progress', payload);
  }

  public emitZipStarted(roomKey: string, data?: unknown): void {
    const payload = this.buildPayload('zip-started', 0, 'Creating ZIP archive...', undefined, undefined, data);
    this.emitToRoom(roomKey, 'zip-started', payload);
  }

  public emitZipProgress(roomKey: string, percentage: number): void {
    const payload = this.buildPayload('zip-progress', percentage, 'Archiving files into ZIP...');
    this.emitToRoom(roomKey, 'zip-progress', payload);
  }

  public emitZipCompleted(roomKey: string, data?: unknown): void {
    const payload = this.buildPayload('zip-completed', 100, 'ZIP archive created', undefined, undefined, data);
    this.emitToRoom(roomKey, 'zip-completed', payload);
  }

  public emitDriveUploadStarted(roomKey: string, data?: unknown): void {
    const payload = this.buildPayload('drive-upload-started', 0, 'Uploading to Google Drive...', undefined, undefined, data);
    this.emitToRoom(roomKey, 'drive-upload-started', payload);
  }

  public emitDriveUploadProgress(roomKey: string, percentage: number): void {
    const payload = this.buildPayload('drive-upload-progress', percentage, 'Uploading to Google Drive...');
    this.emitToRoom(roomKey, 'drive-upload-progress', payload);
  }

  public emitDriveUploadCompleted(roomKey: string, data?: unknown): void {
    const payload = this.buildPayload('drive-upload-completed', 100, 'Google Drive upload completed', undefined, undefined, data);
    this.emitToRoom(roomKey, 'drive-upload-completed', payload);
  }

  public emitTransferProcessing(roomKey: string, message = 'Processing transfer...'): void {
    const payload = this.buildPayload('transfer-processing', undefined, message);
    this.emitToRoom(roomKey, 'transfer-processing', payload);
  }

  public emitTransferReady(roomKey: string, transferData: unknown): void {
    const payload = this.buildPayload('transfer-ready', 100, 'Transfer ready', undefined, undefined, transferData);
    this.emitToRoom(roomKey, 'transfer-ready', payload);
  }

  public emitDownloadStarted(roomKey: string, data: unknown): void {
    const payload = this.buildPayload('download-started', 0, 'Download started', undefined, undefined, data);
    this.emitToRoom(roomKey, 'download-started', payload);
  }

  public emitDownloadProgress(roomKey: string, percentage: number): void {
    const payload = this.buildPayload('download-progress', percentage, 'Downloading...');
    this.emitToRoom(roomKey, 'download-progress', payload);
  }

  public emitDownloadCompleted(roomKey: string, data: unknown): void {
    const payload = this.buildPayload('download-completed', 100, 'Download completed', undefined, undefined, data);
    this.emitToRoom(roomKey, 'download-completed', payload);
    this.emitToRoom(roomKey, 'completed', payload); // Legacy alias
  }

  public emitCompleted(roomKey: string, data: unknown): void {
    this.emitDownloadCompleted(roomKey, data);
  }

  public emitDownloadFailed(roomKey: string, errorData: unknown): void {
    const payload = this.buildPayload('error', undefined, 'Download failed', undefined, undefined, errorData);
    this.emitToRoom(roomKey, 'download-failed', payload);
  }

  public emitExpired(roomKey: string, data: unknown): void {
    const payload = this.buildPayload('transfer-expired', 0, 'Transfer expired', undefined, undefined, data);
    this.emitToRoom(roomKey, 'transfer-expired', payload);
    this.emitToRoom(roomKey, 'expired', payload); // Legacy alias
  }

  public emitTransferDeleted(roomKey: string, data?: unknown): void {
    const payload = this.buildPayload('transfer-deleted', 0, 'Transfer deleted', undefined, undefined, data);
    this.emitToRoom(roomKey, 'transfer-deleted', payload);
  }

  public emitCleanupStarted(data?: unknown): void {
    if (this.socketNamespace) {
      const payload = this.buildPayload('cleanup-started', 0, 'Background cleanup started', undefined, undefined, data);
      this.socketNamespace.emit('cleanup-started', payload);
    }
  }

  public emitCleanupCompleted(data?: unknown): void {
    if (this.socketNamespace) {
      const payload = this.buildPayload('cleanup-completed', 100, 'Background cleanup completed', undefined, undefined, data);
      this.socketNamespace.emit('cleanup-completed', payload);
    }
  }

  public emitError(roomKey: string, message: string): void {
    const payload = this.buildPayload('error', undefined, message);
    this.emitToRoom(roomKey, 'error', payload);
  }

  public close(): void {
    if (this.io) {
      this.io.close();
      this.io = null;
      this.socketNamespace = null;
      logger.info('🔌 Socket.IO server closed');
    }
  }
}

export const socketService = SocketService.getInstance();
