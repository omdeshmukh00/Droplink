import { Response } from 'express';
import { transferRepository, TransferRepository } from '../../transfer/repositories/transfer.repository';
import { GoogleDriveStorageProvider } from '../../../storage/providers/GoogleDriveStorageProvider';
import { socketService } from '../../../services/socket.service';
import { TRANSFER_STATUS } from '../../transfer/constants/transfer.constants';
import { formatShareId, normalizeShareId } from '../../transfer/utils/generateShareId';
import {
  DownloadNotFoundError,
  DownloadExpiredError,
  DownloadLimitExceededError,
  DownloadStreamError,
} from '../errors/download.errors';
import { DownloadStatusDto, DownloadMetadataDto } from '../dto/download.dto';
import { logger } from '../../../utils/logger';

export class DownloadService {
  private readonly repository: TransferRepository;
  private readonly driveProvider: GoogleDriveStorageProvider;

  constructor(
    repository: TransferRepository = transferRepository,
    driveProvider: GoogleDriveStorageProvider = new GoogleDriveStorageProvider()
  ) {
    this.repository = repository;
    this.driveProvider = driveProvider;
  }

  /**
   * Streams file download securely from Google Drive to browser HTTP response stream.
   */
  public async streamDownload(token: string, res: Response): Promise<void> {
    if (!token) {
      throw new DownloadNotFoundError('Download token is required');
    }

    const transfer = await this.repository.findByToken(token);
    if (!transfer || transfer.status === TRANSFER_STATUS.DELETED) {
      logger.warn(`Download Failed: Transfer not found or deleted for token ${token}`);
      throw new DownloadNotFoundError();
    }

    const now = new Date();
    if (transfer.expiresAt <= now || transfer.status === TRANSFER_STATUS.EXPIRED) {
      logger.warn(`Expired Transfer access attempt for token ${token}`);
      if (transfer.status !== TRANSFER_STATUS.EXPIRED) {
        await this.repository.updateStatus(transfer._id.toString(), TRANSFER_STATUS.EXPIRED);
      }
      socketService.emitExpired(token, { message: 'Transfer expired' });
      throw new DownloadExpiredError();
    }

    if (transfer.downloadCount >= transfer.maxDownloads) {
      logger.warn(`Limit Exceeded for token ${token}: count ${transfer.downloadCount}/${transfer.maxDownloads}`);
      throw new DownloadLimitExceededError('Download limit exceeded');
    }

    // Verify Google Drive file existence before streaming
    const fileExists = await this.driveProvider.exists(transfer.driveFileId);
    if (!fileExists) {
      logger.error(`Download Failed: File missing on Google Drive for token ${token} (${transfer.driveFileId})`);
      await this.repository.updateStatus(transfer._id.toString(), TRANSFER_STATUS.FAILED);
      throw new DownloadNotFoundError('File is no longer available on storage provider');
    }

    // Atomically increment download count
    const updatedTransfer = await this.repository.incrementDownloadCount(
      transfer._id.toString(),
      transfer.maxDownloads
    );

    if (!updatedTransfer) {
      logger.warn(`Limit Exceeded during atomic increment for token ${token}`);
      throw new DownloadLimitExceededError('Download limit exceeded');
    }

    // Configure HTTP Download Response Headers
    res.setHeader('Content-Type', transfer.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(transfer.storedName)}"`
    );
    res.setHeader('Content-Length', transfer.size.toString());
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    logger.info(`Download Started: Token=${token}, File=${transfer.storedName}, Size=${transfer.size}B`);

    // Socket notification for download start
    socketService.emitDownloadStarted(token, {
      token,
      downloadCount: updatedTransfer.downloadCount,
      maxDownloads: updatedTransfer.maxDownloads,
      remainingDownloads: Math.max(0, updatedTransfer.maxDownloads - updatedTransfer.downloadCount),
    });

    // Obtain Read Stream from Google Drive
    const readStream = await this.driveProvider.download(transfer.driveFileId);

    let bytesSent = 0;
    readStream.on('data', (chunk: Buffer) => {
      bytesSent += chunk.length;
      if (transfer.size > 0) {
        const progressPercentage = Math.round((bytesSent / transfer.size) * 100);
        socketService.emitDownloadProgress(token, progressPercentage);
      }
    });

    readStream.on('error', (error: unknown) => {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Download Failed for token ${token}:`, { error: errorMsg });

      socketService.emitDownloadFailed(token, { error: errorMsg });

      if (!res.headersSent) {
        throw new DownloadStreamError(errorMsg);
      }
    });

    readStream.pipe(res as any);

    res.on('finish', async () => {
      logger.info(`Download Completed: Token=${token}, Bytes=${bytesSent}`);

      const remaining = Math.max(0, updatedTransfer.maxDownloads - updatedTransfer.downloadCount);

      socketService.emitCompleted(token, {
        token,
        downloadCount: updatedTransfer.downloadCount,
        maxDownloads: updatedTransfer.maxDownloads,
        remainingDownloads: remaining,
      });

      // Auto-Delete if download limit reached!
      if (updatedTransfer.downloadCount >= updatedTransfer.maxDownloads) {
        logger.info(`Auto-Delete triggered: Max downloads reached for token ${token}`);

        try {
          await this.driveProvider.delete(updatedTransfer.driveFileId);
          logger.info(`File Deleted from Google Drive: FileID=${updatedTransfer.driveFileId}`);
        } catch (delErr) {
          logger.warn(`Failed to delete Drive file during auto-delete: ${updatedTransfer.driveFileId}`, { delErr });
        }

        await this.repository.updateStatus(
          updatedTransfer._id.toString(),
          TRANSFER_STATUS.COMPLETED,
          { downloadCompletedAt: new Date() }
        );

        socketService.emitExpired(token, { message: 'Transfer completed and file deleted' });
      }
    });
  }

  /**
   * Retrieves transfer download status information.
   */
  public async getDownloadStatus(tokenOrShareId: string): Promise<DownloadStatusDto> {
    if (!tokenOrShareId) {
      throw new DownloadNotFoundError('Token or Share ID is required');
    }

    const normalized = normalizeShareId(tokenOrShareId);
    let transfer = await this.repository.findByToken(tokenOrShareId);

    if (!transfer) {
      transfer = await this.repository.findByShareId(normalized);
    }

    if (!transfer || transfer.status === TRANSFER_STATUS.DELETED) {
      throw new DownloadNotFoundError();
    }

    const now = new Date();
    const isExpired =
      transfer.expiresAt <= now ||
      transfer.status === TRANSFER_STATUS.EXPIRED;

    const remainingDownloads = Math.max(0, transfer.maxDownloads - transfer.downloadCount);
    const remainingTime = isExpired
      ? 0
      : Math.max(0, Math.floor((transfer.expiresAt.getTime() - now.getTime()) / 1000));

    return {
      token: transfer.token,
      shareId: formatShareId(transfer.shareId),
      status: isExpired ? TRANSFER_STATUS.EXPIRED : transfer.status,
      downloadCount: transfer.downloadCount,
      remainingDownloads,
      expiresAt: transfer.expiresAt.toISOString(),
      remainingTime,
      fileName: transfer.originalName || transfer.storedName,
      fileSize: transfer.size,
      transferType: transfer.transferType,
    };
  }

  /**
   * Retrieves transfer metadata by Share ID for receiver lookup.
   */
  public async getMetadataByShareId(rawShareId: string): Promise<DownloadMetadataDto> {
    if (!rawShareId) {
      throw new DownloadNotFoundError('Share ID is required');
    }

    const normalized = normalizeShareId(rawShareId);
    const transfer = await this.repository.findByShareId(normalized);

    if (!transfer || transfer.status === TRANSFER_STATUS.DELETED) {
      throw new DownloadNotFoundError();
    }

    const now = new Date();
    if (transfer.expiresAt <= now || transfer.status === TRANSFER_STATUS.EXPIRED) {
      if (transfer.status !== TRANSFER_STATUS.EXPIRED) {
        this.repository.updateStatus(transfer._id.toString(), TRANSFER_STATUS.EXPIRED).catch(() => {});
      }
      throw new DownloadExpiredError();
    }

    if (transfer.downloadCount >= transfer.maxDownloads) {
      throw new DownloadLimitExceededError();
    }

    return {
      token: transfer.token,
      shareId: formatShareId(transfer.shareId),
      fileName: transfer.originalName || transfer.storedName,
      fileSize: transfer.size,
      mimeType: transfer.mimeType,
      transferType: transfer.transferType,
      status: transfer.status,
      expiresAt: transfer.expiresAt.toISOString(),
      downloadCount: transfer.downloadCount,
      remainingDownloads: Math.max(0, transfer.maxDownloads - transfer.downloadCount),
    };
  }
}

export const downloadService = new DownloadService();
