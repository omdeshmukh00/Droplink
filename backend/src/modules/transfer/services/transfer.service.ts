import fs from 'fs';
import path from 'path';
import { Response } from 'express';
import { TransferRepository, transferRepository } from '../repositories/transfer.repository';
import { GoogleDriveStorageProvider } from '../../../storage/providers/GoogleDriveStorageProvider';
import { socketService } from '../../../services/socket.service';
import { createTransferSchema, CreateTransferInput } from '../validators/transfer.validator';
import { TransferResponseDto, TransferStatusDto } from '../dto/transfer.dto';
import { TRANSFER_STATUS, TransferStatusType } from '../constants/transfer.constants';
import {
  TransferNotFoundError,
  TransferExpiredError,
  TransferDownloadLimitError,
  TransferValidationError,
} from '../errors/transfer.errors';
import { generateTransferToken } from '../utils/generateToken';
import { generateShareId, formatShareId, normalizeShareId } from '../utils/generateShareId';
import { createZipArchive } from '../utils/createZip';
import { buildQRPayload } from '../utils/qrPayload';
import { logger } from '../../../utils/logger';
import { ITransferDocument } from '../interfaces/transfer.interface';
import { DriveMetadata } from '../types/transfer.types';

export class TransferService {
  private readonly repository: TransferRepository;
  private readonly driveProvider: GoogleDriveStorageProvider;

  constructor(repository: TransferRepository = transferRepository) {
    this.repository = repository;
    this.driveProvider = new GoogleDriveStorageProvider();
  }

  /**
   * Creates a new file transfer, processes uploaded files, stores them on Google Drive,
   * cleans up temporary local files immediately, and saves metadata to MongoDB.
   */
  public async createTransfer(
    files: Express.Multer.File[],
    options: CreateTransferInput,
    createdBy?: string
  ): Promise<TransferResponseDto> {
    if (!files || files.length === 0) {
      throw new TransferValidationError('No files uploaded. Please attach at least one file.');
    }

    let isZip = files.length > 1;
    let targetUploadPath: string;
    let targetFileName: string;
    let targetMimeType: string;
    let totalSize = 0;
    let temporaryFilesToCleanup: string[] = [];

    // Track local file paths from Multer diskStorage
    for (const f of files) {
      if (f.path) {
        temporaryFilesToCleanup.push(f.path);
      }
      totalSize += f.size;
    }

    // 1. Pre-generate secure token & unique share ID for room emissions
    const token = generateTransferToken();
    let rawShareId = generateShareId();
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      const existing = await this.repository.findByShareId(rawShareId);
      if (!existing) {
        isUnique = true;
      } else {
        rawShareId = generateShareId();
        attempts++;
      }
    }

    if (!isUnique) {
      throw new Error('Failed to generate unique Share ID');
    }

    socketService.emitUploadStarted(token, { filesCount: files.length, totalSize });
    socketService.emitUploadStarted(rawShareId, { filesCount: files.length, totalSize });

    try {
      if (isZip) {
        logger.info(`Creating ZIP archive for ${files.length} uploaded files...`);
        socketService.emitZipStarted(token);
        socketService.emitZipStarted(rawShareId);

        const filesToZip = files.map((f) => ({
          path: f.path,
          originalName: f.originalname,
        }));

        const zipToken = generateTransferToken().slice(0, 8);
        const zipName = `DropLink-Transfer-${zipToken}.zip`;

        const zipResult = await createZipArchive(filesToZip, zipName);
        targetUploadPath = zipResult.zipPath;
        targetFileName = zipResult.filename;
        targetMimeType = 'application/zip';
        totalSize = zipResult.size;

        temporaryFilesToCleanup.push(zipResult.zipPath);

        socketService.emitZipCompleted(token, { zipName, size: zipResult.size });
        socketService.emitZipCompleted(rawShareId, { zipName, size: zipResult.size });
      } else {
        const singleFile = files[0];
        if (!singleFile) {
          throw new TransferValidationError('Uploaded file details missing');
        }
        targetUploadPath = singleFile.path;
        targetFileName = singleFile.originalname;
        targetMimeType = singleFile.mimetype || 'application/octet-stream';
      }

      // 2. Upload to Google Drive
      logger.info(`Uploading file to Google Drive: ${targetFileName}`, { mimeType: targetMimeType });
      socketService.emitDriveUploadStarted(token, { filename: targetFileName });
      socketService.emitDriveUploadStarted(rawShareId, { filename: targetFileName });

      const driveUpload = await this.driveProvider.upload(
        targetUploadPath,
        targetFileName,
        targetMimeType
      );

      socketService.emitDriveUploadCompleted(token, { fileId: driveUpload.fileId });
      socketService.emitDriveUploadCompleted(rawShareId, { fileId: driveUpload.fileId });

      // 3. Fetch Drive Metadata & Save MongoDB
      socketService.emitTransferProcessing(token, 'Saving transfer metadata...');
      socketService.emitTransferProcessing(rawShareId, 'Saving transfer metadata...');

      let driveMetadata: DriveMetadata = {
        fileId: driveUpload.fileId,
        mimeType: targetMimeType,
      };

      try {
        const fullMetadata = await this.driveProvider.getMetadata(driveUpload.fileId);
        driveMetadata = {
          fileId: fullMetadata.id,
          md5Checksum: fullMetadata.md5Checksum,
          mimeType: fullMetadata.mimeType,
          createdTime: fullMetadata.createdTime,
        };
      } catch (metaErr) {
        logger.warn('Failed to fetch detailed drive metadata, using basic metadata', { metaErr });
      }

      // 4. Calculate Max Downloads & Expiry
      const parsedOptions = createTransferSchema.parse(options || {});

      const maxDownloads =
        parsedOptions.receiverLimitEnabled && parsedOptions.receiverLimit
          ? parsedOptions.receiverLimit
          : parsedOptions.maxDownloads;

      const expiryMinutes = parsedOptions.expiryMinutes;
      const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

      // 5. Save in MongoDB
      const transferDoc = await this.repository.create({
        token,
        shareId: rawShareId,
        driveFileId: driveUpload.fileId,
        originalName: files[0]?.originalname || targetFileName,
        storedName: targetFileName,
        mimeType: targetMimeType,
        size: totalSize,
        status: TRANSFER_STATUS.READY,
        downloadCount: 0,
        maxDownloads,
        receiverLimitEnabled: parsedOptions.receiverLimitEnabled,
        receiverLimit: parsedOptions.receiverLimit,
        expiresAt,
        createdBy,
        transferType: isZip ? 'zip' : 'single',
        driveMetadata,
      });

      const responseDto = this.formatTransferResponse(transferDoc);

      // Emit Socket Ready event
      socketService.emitTransferReady(token, responseDto);
      socketService.emitTransferReady(rawShareId, responseDto);

      logger.info(
        `✨ Transfer created successfully: Token=${token}, ShareID=${responseDto.shareId}, DriveID=${driveUpload.fileId}`
      );

      return responseDto;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to create transfer', { error: errorMessage });
      throw error;
    } finally {
      // 6. ALWAYS delete all temporary local files immediately after upload
      logger.info('Cleaning up temporary local files...');
      for (const tempPath of temporaryFilesToCleanup) {
        if (tempPath && fs.existsSync(tempPath)) {
          try {
            fs.unlinkSync(tempPath);
            logger.debug(`Deleted temp file: ${tempPath}`);
          } catch (unlinkErr) {
            logger.warn(`Failed to delete temp file: ${tempPath}`, { unlinkErr });
          }
        }
      }
    }
  }

  /**
   * Retrieves transfer details by secure token.
   */
  public async getTransferByToken(token: string): Promise<TransferResponseDto> {
    if (!token) {
      throw new TransferValidationError('Transfer token is required');
    }

    const transfer = await this.repository.findByToken(token);
    return this.validateAndFormatTransfer(transfer);
  }

  /**
   * Retrieves transfer details by Share ID (supports formatted or raw).
   */
  public async getTransferByShareId(rawShareId: string): Promise<TransferResponseDto> {
    if (!rawShareId) {
      throw new TransferValidationError('Share ID is required');
    }

    const normalized = normalizeShareId(rawShareId);
    const transfer = await this.repository.findByShareId(normalized);
    return this.validateAndFormatTransfer(transfer);
  }

  /**
   * Retrieves transfer status information by token.
   */
  public async getTransferStatus(token: string): Promise<TransferStatusDto> {
    if (!token) {
      throw new TransferValidationError('Transfer token is required');
    }

    const transfer = await this.repository.findByToken(token);
    if (!transfer) {
      throw new TransferNotFoundError();
    }

    const now = new Date();
    const isExpired =
      transfer.expiresAt <= now ||
      transfer.status === TRANSFER_STATUS.EXPIRED ||
      transfer.status === TRANSFER_STATUS.DELETED;

    const remainingDownloads = Math.max(0, transfer.maxDownloads - transfer.downloadCount);
    const secondsRemaining = isExpired
      ? 0
      : Math.max(0, Math.floor((transfer.expiresAt.getTime() - now.getTime()) / 1000));

    return {
      token: transfer.token,
      shareId: formatShareId(transfer.shareId),
      status: isExpired ? TRANSFER_STATUS.EXPIRED : transfer.status,
      downloadCount: transfer.downloadCount,
      maxDownloads: transfer.maxDownloads,
      remainingDownloads,
      receiverLimitEnabled: transfer.receiverLimitEnabled,
      receiverLimit: transfer.receiverLimit,
      expiresAt: transfer.expiresAt.toISOString(),
      secondsRemaining,
      isExpired,
    };
  }

  /**
   * Streams file download from Google Drive directly to Express HTTP response stream.
   */
  public async streamDownload(token: string, res: Response): Promise<void> {
    if (!token) {
      throw new TransferValidationError('Transfer token is required');
    }

    const transfer = await this.repository.findByToken(token);
    if (!transfer || transfer.status === TRANSFER_STATUS.DELETED) {
      throw new TransferNotFoundError();
    }

    const now = new Date();
    if (transfer.expiresAt <= now || transfer.status === TRANSFER_STATUS.EXPIRED) {
      if (transfer.status !== TRANSFER_STATUS.EXPIRED) {
        await this.repository.updateStatus(transfer._id.toString(), TRANSFER_STATUS.EXPIRED);
      }
      throw new TransferExpiredError();
    }

    if (transfer.downloadCount >= transfer.maxDownloads) {
      throw new TransferDownloadLimitError();
    }

    // Atomically increment download count
    const updatedTransfer = await this.repository.incrementDownloadCount(
      transfer._id.toString(),
      transfer.maxDownloads
    );

    if (!updatedTransfer) {
      throw new TransferDownloadLimitError();
    }

    // Verify Google Drive file existence
    const driveExists = await this.driveProvider.exists(transfer.driveFileId);
    if (!driveExists) {
      logger.error(`File missing on Google Drive for transfer token ${token}: ${transfer.driveFileId}`);
      await this.repository.updateStatus(transfer._id.toString(), TRANSFER_STATUS.FAILED);
      throw new TransferNotFoundError('File is no longer available on cloud storage');
    }

    // Set Response HTTP Headers for streaming attachment
    res.setHeader('Content-Type', transfer.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(transfer.storedName)}"`
    );
    res.setHeader('Content-Length', transfer.size.toString());
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    // Notify Socket clients
    socketService.emitDownloadStarted(token, {
      token,
      downloadCount: updatedTransfer.downloadCount,
      maxDownloads: updatedTransfer.maxDownloads,
      remainingDownloads: Math.max(0, updatedTransfer.maxDownloads - updatedTransfer.downloadCount),
    });

    // Obtain Read Stream from Google Drive
    const driveStream = await this.driveProvider.download(transfer.driveFileId);

    let bytesSent = 0;
    driveStream.on('data', (chunk: Buffer) => {
      bytesSent += chunk.length;
      if (transfer.size > 0) {
        const progressPercentage = Math.round((bytesSent / transfer.size) * 100);
        socketService.emitDownloadProgress(token, progressPercentage);
      }
    });

    driveStream.on('error', (error: unknown) => {
      logger.error(`Error streaming download for transfer token ${token}:`, error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: { code: 'STREAM_ERROR', message: 'Failed to stream file download' },
        });
      }
    });

    driveStream.pipe(res as any);

    res.on('finish', async () => {
      logger.info(`📥 Download completed for token ${token}: ${bytesSent} bytes streamed.`);

      const remaining = Math.max(0, updatedTransfer.maxDownloads - updatedTransfer.downloadCount);

      socketService.emitCompleted(token, {
        token,
        downloadCount: updatedTransfer.downloadCount,
        maxDownloads: updatedTransfer.maxDownloads,
        remainingDownloads: remaining,
      });

      // Immediate Cleanup if max download limit reached!
      if (updatedTransfer.downloadCount >= updatedTransfer.maxDownloads) {
        logger.info(
          `🔒 Max downloads (${updatedTransfer.maxDownloads}) reached for token ${token}. Triggering immediate Google Drive cleanup.`
        );

        try {
          await this.driveProvider.delete(updatedTransfer.driveFileId);
        } catch (delErr) {
          logger.warn(`Failed to delete Google Drive file '${updatedTransfer.driveFileId}'`, { delErr });
        }

        await this.repository.updateStatus(
          updatedTransfer._id.toString(),
          TRANSFER_STATUS.COMPLETED,
          { downloadCompletedAt: new Date() }
        );
      }
    });
  }

  /**
   * Deletes a transfer by token, purging its file from Google Drive and marking status DELETED.
   */
  public async deleteTransfer(token: string): Promise<{ message: string }> {
    if (!token) {
      throw new TransferValidationError('Transfer token is required');
    }

    const transfer = await this.repository.findByToken(token);
    if (!transfer) {
      throw new TransferNotFoundError();
    }

    try {
      await this.driveProvider.delete(transfer.driveFileId);
    } catch (err) {
      logger.warn(`Drive deletion error for file '${transfer.driveFileId}'`, { err });
    }

    await this.repository.deleteByToken(token);

    socketService.emitExpired(token, { message: 'Transfer deleted' });
    socketService.emitExpired(transfer.shareId, { message: 'Transfer deleted' });

    logger.info(`🗑️ Transfer deleted by token: ${token}`);
    return { message: 'Transfer deleted successfully' };
  }

  /**
   * Scheduled cleanup: Deletes expired transfers and purges files from Google Drive.
   */
  public async cleanupExpiredTransfers(): Promise<{ cleanedCount: number }> {
    const expiredList = await this.repository.findExpired();
    let cleanedCount = 0;

    for (const transfer of expiredList) {
      try {
        await this.driveProvider.delete(transfer.driveFileId);
      } catch (err) {
        logger.debug(`Failed drive deletion during cleanup for file '${transfer.driveFileId}'`);
      }

      await this.repository.updateStatus(transfer._id.toString(), TRANSFER_STATUS.EXPIRED);
      cleanedCount++;
    }

    if (cleanedCount > 0) {
      logger.info(`🧹 Scheduled cleanup: Purged ${cleanedCount} expired transfers from Google Drive.`);
    }

    return { cleanedCount };
  }

  private validateAndFormatTransfer(transfer: ITransferDocument | null): TransferResponseDto {
    if (!transfer || transfer.status === TRANSFER_STATUS.DELETED) {
      throw new TransferNotFoundError();
    }

    const now = new Date();
    if (transfer.expiresAt <= now || transfer.status === TRANSFER_STATUS.EXPIRED) {
      if (transfer.status !== TRANSFER_STATUS.EXPIRED) {
        this.repository.updateStatus(transfer._id.toString(), TRANSFER_STATUS.EXPIRED).catch(() => {});
      }
      throw new TransferExpiredError();
    }

    if (transfer.downloadCount >= transfer.maxDownloads) {
      throw new TransferDownloadLimitError();
    }

    return this.formatTransferResponse(transfer);
  }

  private formatTransferResponse(transfer: ITransferDocument): TransferResponseDto {
    const formattedShareId = formatShareId(transfer.shareId);
    const qrPayload = buildQRPayload(transfer.token, transfer.shareId);

    return {
      token: transfer.token,
      shareId: formattedShareId,
      shareUrl: qrPayload.shareUrl,
      qrPayload,
      originalName: transfer.originalName,
      storedName: transfer.storedName,
      mimeType: transfer.mimeType,
      size: transfer.size,
      status: transfer.status,
      downloadCount: transfer.downloadCount,
      maxDownloads: transfer.maxDownloads,
      receiverLimitEnabled: transfer.receiverLimitEnabled,
      receiverLimit: transfer.receiverLimit,
      remainingDownloads: Math.max(0, transfer.maxDownloads - transfer.downloadCount),
      expiresAt: transfer.expiresAt.toISOString(),
      createdAt: transfer.createdAt.toISOString(),
      transferType: transfer.transferType,
    };
  }
}

export const transferService = new TransferService();
