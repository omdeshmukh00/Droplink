import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';
import mongoose from 'mongoose';
import multer from 'multer';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { transferService } from '../src/modules/transfer/services/transfer.service';
import { downloadService } from '../src/modules/download/services/download.service';
import { GoogleDriveStorageProvider } from '../src/storage/providers/GoogleDriveStorageProvider';
import { env } from '../src/config/env';
import { logger } from '../src/utils/logger';
import {
  DownloadNotFoundError,
  DownloadExpiredError,
  DownloadLimitExceededError,
} from '../src/modules/download/errors/download.errors';
import { TransferModel } from '../src/modules/transfer/models/transfer.model';

// Mock Express Response Stream for testing downloads
class MockExpressResponse extends EventEmitter {
  public headers: Record<string, string> = {};
  public statusCode: number = 200;
  public chunks: Buffer[] = [];
  public headersSent: boolean = false;

  public setHeader(key: string, value: string) {
    this.headers[key.toLowerCase()] = value;
  }

  public write(chunk: any) {
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return true;
  }

  public end(chunk?: any) {
    if (chunk) {
      this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    this.emit('finish');
  }

  public status(code: number) {
    this.statusCode = code;
    return this;
  }

  public json(payload: any) {
    this.emit('finish');
    return payload;
  }

  public getBodyString(): string {
    return Buffer.concat(this.chunks).toString('utf-8');
  }
}

function createMockMulterFile(filename: string, content: string): Express.Multer.File {
  const uploadsDir = path.resolve(process.cwd(), 'temp', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const filePath = path.join(uploadsDir, `${Date.now()}_${filename}`);
  fs.writeFileSync(filePath, content, 'utf-8');
  const size = Buffer.byteLength(content);

  return {
    fieldname: 'files',
    originalname: filename,
    encoding: '7bit',
    mimetype: 'text/plain',
    size,
    destination: uploadsDir,
    filename: path.basename(filePath),
    path: filePath,
    buffer: Buffer.from(content),
    stream: fs.createReadStream(filePath),
  };
}

async function runDownloadModuleVerification() {
  logger.info('🚀 Starting Download Module comprehensive test suite...');
  const driveProvider = new GoogleDriveStorageProvider();

  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(env.MONGODB_URI);
      logger.info('Connected to MongoDB for Download Module verification');
    }

    // 1. Test Valid Download & Stream Integrity
    logger.info('Test 1: Valid Download & Stream Integrity');
    const testContent = `Download Module Stream Integrity Test Content - ${Date.now()}`;
    const testFile = createMockMulterFile('valid-download.txt', testContent);

    const transfer = await transferService.createTransfer([testFile], {
      maxDownloads: 5,
      receiverLimitEnabled: false,
      expiryMinutes: 10,
    });

    console.log('\n--- Transfer Created ---');
    console.log('Token:', transfer.token);
    console.log('Share ID:', transfer.shareId);

    const mockRes = new MockExpressResponse();
    const downloadPromise = new Promise<void>((resolve) => {
      mockRes.on('finish', () => resolve());
    });

    await downloadService.streamDownload(transfer.token, mockRes as any);
    await downloadPromise;

    const downloadedContent = mockRes.getBodyString();
    if (downloadedContent !== testContent) {
      throw new Error(`Stream content mismatch! Expected '${testContent}', got '${downloadedContent}'`);
    }

    if (mockRes.headers['content-disposition']?.includes(encodeURIComponent('valid-download.txt'))) {
      logger.info('✔ Content-Disposition header verified correctly');
    }
    logger.info('✔ Stream download completed with 100% data integrity match');

    // 2. Test Share ID Lookup & Status
    logger.info('Test 2: Share ID Lookup & Status DTO');
    const statusDto = await downloadService.getDownloadStatus(transfer.shareId);
    console.log('Download Status:', statusDto);

    if (statusDto.downloadCount !== 1 || statusDto.remainingDownloads !== 4) {
      throw new Error(`Unexpected download count! Count=${statusDto.downloadCount}, Remaining=${statusDto.remainingDownloads}`);
    }

    const metadataDto = await downloadService.getMetadataByShareId(transfer.shareId);
    if (metadataDto.token !== transfer.token) {
      throw new Error('Share ID metadata lookup returned wrong token');
    }
    logger.info('✔ Share ID lookup and status DTO verified');

    // 3. Test Invalid Token (HTTP 404)
    logger.info('Test 3: Invalid Token (HTTP 404)');
    try {
      const dummyRes = new MockExpressResponse();
      await downloadService.streamDownload('invalid_token_99999999', dummyRes as any);
      throw new Error('Should have thrown DownloadNotFoundError for invalid token');
    } catch (err: unknown) {
      if (err instanceof DownloadNotFoundError) {
        logger.info('✔ Threw expected DownloadNotFoundError (404)');
      } else {
        throw err;
      }
    }

    // 4. Test Expired Transfer (HTTP 410)
    logger.info('Test 4: Expired Transfer (HTTP 410)');
    const expiredFile = createMockMulterFile('expired.txt', 'Expired payload');
    const expiredTransfer = await transferService.createTransfer([expiredFile], {
      expiryMinutes: 10,
    });

    // Artificially expire in MongoDB
    await TransferModel.updateOne(
      { token: expiredTransfer.token },
      { $set: { expiresAt: new Date(Date.now() - 60000) } }
    );

    try {
      const dummyRes = new MockExpressResponse();
      await downloadService.streamDownload(expiredTransfer.token, dummyRes as any);
      throw new Error('Should have thrown DownloadExpiredError for expired transfer');
    } catch (err: unknown) {
      if (err instanceof DownloadExpiredError) {
        logger.info('✔ Threw expected DownloadExpiredError (410)');
      } else {
        throw err;
      }
    }

    // 5. Test Receiver Limit & Auto Delete (HTTP 429 & Cloud Cleanup)
    logger.info('Test 5: Receiver Limit & Auto Delete after quota reached');
    const limitContent = 'One-Time Receiver Limit Download Payload';
    const limitFile = createMockMulterFile('one-time.txt', limitContent);

    const limitTransfer = await transferService.createTransfer([limitFile], {
      maxDownloads: 1,
      receiverLimitEnabled: true,
      receiverLimit: 1,
      expiryMinutes: 10,
    });

    const docBefore = await TransferModel.findOne({ token: limitTransfer.token });
    const driveFileId = docBefore?.driveFileId;
    if (!driveFileId) throw new Error('Missing driveFileId in DB');

    // First download (reaching quota of 1)
    const limitRes1 = new MockExpressResponse();
    const downloadPromise1 = new Promise<void>((resolve) => {
      limitRes1.on('finish', () => resolve());
    });
    await downloadService.streamDownload(limitTransfer.token, limitRes1 as any);
    await downloadPromise1;

    logger.info('✔ First download completed successfully');

    // Wait short delay for async res finish event auto-delete handler
    await new Promise((r) => setTimeout(r, 1500));

    // Verify Google Drive deletion
    const existsOnDrive = await driveProvider.exists(driveFileId);
    if (existsOnDrive) {
      throw new Error(`Google Drive file '${driveFileId}' was NOT deleted after max download limit!`);
    }
    logger.info('✔ Google Drive file deleted automatically after reaching download limit');

    // Attempt second download (should throw HTTP 429 / 404 limit exceeded error)
    try {
      const limitRes2 = new MockExpressResponse();
      await downloadService.streamDownload(limitTransfer.token, limitRes2 as any);
      throw new Error('Should have thrown DownloadLimitExceededError on second download!');
    } catch (err: unknown) {
      if (err instanceof DownloadLimitExceededError || err instanceof DownloadNotFoundError) {
        logger.info('✔ Second download blocked with expected quota limit exceeded error');
      } else {
        throw err;
      }
    }

    // Cleanup first test transfer on cloud & DB
    await transferService.deleteTransfer(transfer.token);
    await transferService.deleteTransfer(expiredTransfer.token);

    console.log('\n🎉 ALL DOWNLOAD MODULE VERIFICATION TESTS PASSED SUCCESSFULLY 🎉\n');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('❌ Download module verification failed:', { error: msg });
    console.error('\n❌ Verification Failed:', msg);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

runDownloadModuleVerification();
