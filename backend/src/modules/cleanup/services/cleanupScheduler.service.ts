import cron, { ScheduledTask } from 'node-cron';
import { transferRepository, TransferRepository } from '../../transfer/repositories/transfer.repository';
import { prisma } from '../../../config/prisma';
import { GoogleDriveStorageProvider } from '../../../storage/providers/GoogleDriveStorageProvider';
import { ITransferDocument } from '../../transfer/interfaces/transfer.interface';
import { TRANSFER_STATUS } from '../../transfer/constants/transfer.constants';
import { CleanupStatsDto } from '../dto/cleanup.dto';
import { env } from '../../../config/env';
import { socketService } from '../../../services/socket.service';
import { logger } from '../../../utils/logger';

export class CleanupSchedulerService {
  private static instance: CleanupSchedulerService;
  private readonly repository: TransferRepository;
  private readonly driveProvider: GoogleDriveStorageProvider;
  private cronTask: ScheduledTask | null = null;
  private isRunning: boolean = false;
  private lastStats: CleanupStatsDto | null = null;

  constructor(
    repository: TransferRepository = transferRepository,
    driveProvider: GoogleDriveStorageProvider = new GoogleDriveStorageProvider()
  ) {
    this.repository = repository;
    this.driveProvider = driveProvider;
  }

  public static getInstance(): CleanupSchedulerService {
    if (!CleanupSchedulerService.instance) {
      CleanupSchedulerService.instance = new CleanupSchedulerService();
    }
    return CleanupSchedulerService.instance;
  }

  /**
   * Automatically starts the background cleanup scheduler.
   */
  public start(): void {
    if (this.cronTask) {
      logger.warn('⏰ Cleanup Scheduler is already running.');
      return;
    }

    const intervalMinutes = env.CLEANUP_INTERVAL_MINUTES || 5;
    const cronExpression = `*/${intervalMinutes} * * * *`;

    logger.info(`Cleanup Scheduler Started. Interval: ${intervalMinutes} minutes (${cronExpression})`);

    this.cronTask = cron.schedule(cronExpression, async () => {
      try {
        await this.runCleanup();
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error('❌ Unexpected error in Cleanup Scheduler execution cycle:', { error: errorMsg });
      }
    });
  }

  /**
   * Gracefully stops the background scheduler task.
   */
  public stop(): void {
    if (this.cronTask) {
      this.cronTask.stop();
      this.cronTask = null;
      logger.info('⏰ Cleanup Scheduler stopped gracefully.');
    }
  }

  /**
   * Manually or automatically executes a single cleanup execution cycle.
   */
  public async runCleanup(): Promise<CleanupStatsDto> {
    if (this.isRunning) {
      logger.warn('⚠️ Cleanup cycle already in progress. Skipping duplicate run.');
      return this.lastStats || {
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        executionTime: 0,
        deletedCount: 0,
        failedCount: 0,
        skippedCount: 1,
      };
    }

    this.isRunning = true;
    const startMs = Date.now();
    const startTimeDate = new Date();
    const startTime = startTimeDate.toISOString();

    logger.info('Scheduler Started: Scanning for expired transfers...');
    socketService.emitCleanupStarted({ startTime });

    let deletedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    try {
      // Find all transfers where expiresAt <= now AND status != DELETED
      const expiredTransfers = await this.repository.findExpired(startTimeDate);
      logger.info(`Transfers Found: ${expiredTransfers.length}`);

      // Process transfers sequentially to control concurrency and protect Drive API quotas
      for (const transfer of expiredTransfers) {
        if (transfer.status === TRANSFER_STATUS.DELETED) {
          skippedCount++;
          continue;
        }

        try {
          await this.cleanupTransfer(transfer);
          deletedCount++;
        } catch (err: unknown) {
          failedCount++;
          const message = err instanceof Error ? err.message : String(err);
          logger.error(`Failed to cleanup transfer '${transfer.token}'`, { error: message });
        }
      }
    } catch (globalErr: unknown) {
      const globalMsg = globalErr instanceof Error ? globalErr.message : String(globalErr);
      logger.error('❌ Error querying expired transfers from MongoDB:', { error: globalMsg });
    } finally {
      this.isRunning = false;
    }

    const endMs = Date.now();
    const endTime = new Date(endMs).toISOString();
    const executionTime = endMs - startMs;

    this.lastStats = {
      startTime,
      endTime,
      executionTime,
      deletedCount,
      failedCount,
      skippedCount,
    };

    logger.info(
      `Scheduler Finished: Duration=${executionTime}ms, Total Deleted=${deletedCount}, Total Failed=${failedCount}, Skipped=${skippedCount}`
    );

    socketService.emitCleanupCompleted(this.lastStats);

    return this.lastStats;
  }

  /**
   * Alias for runCleanup().
   */
  public async cleanupExpiredTransfers(): Promise<CleanupStatsDto> {
    return await this.runCleanup();
  }

  /**
   * Performs Google Drive cloud storage cleanup for future cloud storage integration.
   * Note: WebRTC transfers are direct P2P transfers and PostgreSQL database records/senders are preserved.
   */
  public async cleanupTransfer(transfer: ITransferDocument): Promise<void> {
    let driveDeleteSuccess = false;

    // Notify connected clients that transfer link has expired
    socketService.emitExpired(transfer.token, { token: transfer.token, shareId: transfer.shareId });
    if (transfer.shareId) {
      socketService.emitExpired(transfer.shareId, { token: transfer.token, shareId: transfer.shareId });
    }

    // 1. Delete Google Drive file if it exists (Future storage cleanup)
    if (transfer.driveFileId) {
      try {
        const driveExists = await this.driveProvider.exists(transfer.driveFileId);
        if (driveExists) {
          await this.driveProvider.delete(transfer.driveFileId);
          driveDeleteSuccess = true;
          logger.info(`Google Drive storage file cleaned up for token '${transfer.token}'`);
        } else {
          driveDeleteSuccess = true;
        }
      } catch (driveErr: unknown) {
        const driveErrMsg = driveErr instanceof Error ? driveErr.message : String(driveErr);
        logger.error(`Google Drive Delete Failed for file '${transfer.driveFileId}' (Token: ${transfer.token})`, {
          error: driveErrMsg,
        });
      }
    }

    // 2. PostgreSQL / WebRTC transfers & Senders are preserved (No database deletion during Drive cron)
    logger.info(`Google Drive cleanup finished for token '${transfer.token}', DriveDeleted=${driveDeleteSuccess}. Database record preserved.`);
  }

  /**
   * Returns the statistics of the last execution cycle for admin dashboards.
   */
  public getLastStats(): CleanupStatsDto | null {
    return this.lastStats;
  }
}

export const cleanupSchedulerService = CleanupSchedulerService.getInstance();
