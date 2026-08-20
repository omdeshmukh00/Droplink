import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import multer from 'multer';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { transferService } from '../src/modules/transfer/services/transfer.service';
import { cleanupSchedulerService } from '../src/modules/cleanup/services/cleanupScheduler.service';
import { GoogleDriveStorageProvider } from '../src/storage/providers/GoogleDriveStorageProvider';
import { TransferModel } from '../src/modules/transfer/models/transfer.model';
import { env } from '../src/config/env';
import { logger } from '../src/utils/logger';

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

async function runCleanupModuleVerification() {
  logger.info('🚀 Starting Cleanup Scheduler Module verification suite...');
  const driveProvider = new GoogleDriveStorageProvider();

  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(env.MONGODB_URI);
      logger.info('Connected to MongoDB for Cleanup verification');
    }

    // 1. Create Active Transfer (expires in 10 mins)
    logger.info('Test 1: Active Transfer Setup');
    const activeFile = createMockMulterFile('active.txt', 'Active file payload');
    const activeTransfer = await transferService.createTransfer([activeFile], {
      expiryMinutes: 10,
    });
    logger.info(`Created active transfer: Token=${activeTransfer.token}`);

    // 2. Create Expired Transfer (expired 1 minute ago)
    logger.info('Test 2: Expired Transfer Setup');
    const expiredFile = createMockMulterFile('expired.txt', 'Expired file payload');
    const expiredTransfer = await transferService.createTransfer([expiredFile], {
      expiryMinutes: 10,
    });

    const docExpired = await TransferModel.findOne({ token: expiredTransfer.token });
    const expiredDriveFileId = docExpired?.driveFileId;
    if (!expiredDriveFileId) throw new Error('Missing driveFileId for expired transfer');

    // Artificially expire in MongoDB
    await TransferModel.updateOne(
      { token: expiredTransfer.token },
      { $set: { expiresAt: new Date(Date.now() - 60000) } }
    );
    logger.info(`Created expired transfer: Token=${expiredTransfer.token}, DriveID=${expiredDriveFileId}`);

    // 3. Create Expired Transfer with Already Deleted Drive File
    logger.info('Test 3: Expired Transfer with Missing Drive File Setup');
    const missingDriveFile = createMockMulterFile('missing.txt', 'Missing drive file payload');
    const missingDriveTransfer = await transferService.createTransfer([missingDriveFile], {
      expiryMinutes: 10,
    });

    const docMissing = await TransferModel.findOne({ token: missingDriveTransfer.token });
    const missingDriveFileId = docMissing?.driveFileId;
    if (!missingDriveFileId) throw new Error('Missing driveFileId for missing drive transfer');

    // Manually delete file from Drive first
    await driveProvider.delete(missingDriveFileId);
    // Artificially expire in MongoDB
    await TransferModel.updateOne(
      { token: missingDriveTransfer.token },
      { $set: { expiresAt: new Date(Date.now() - 60000) } }
    );
    logger.info(`Created expired transfer with missing drive file: Token=${missingDriveTransfer.token}`);

    // 4. Run Cleanup Cycle
    logger.info('Test 4: Executing runCleanup()');
    const stats = await cleanupSchedulerService.runCleanup();
    console.log('\n--- Cleanup Cycle Statistics ---');
    console.log('Start Time:', stats.startTime);
    console.log('End Time:', stats.endTime);
    console.log('Execution Time:', `${stats.executionTime}ms`);
    console.log('Deleted Count:', stats.deletedCount);
    console.log('Failed Count:', stats.failedCount);
    console.log('Skipped Count:', stats.skippedCount);

    if (stats.deletedCount < 2) {
      throw new Error(`Expected at least 2 deleted transfers, got ${stats.deletedCount}`);
    }
    logger.info('✔ Cleanup cycle statistics verified');

    // 5. Verify Results
    logger.info('Test 5: Verifying Purge & Synchronization');

    // Active transfer must remain intact
    const activeDoc = await TransferModel.findOne({ token: activeTransfer.token });
    if (!activeDoc || activeDoc.status === 'EXPIRED' || activeDoc.status === 'DELETED') {
      throw new Error('Active transfer was incorrectly purged by cleanup!');
    }
    const activeDriveExists = await driveProvider.exists(activeDoc.driveFileId);
    if (!activeDriveExists) {
      throw new Error('Active transfer file on Drive was incorrectly deleted!');
    }
    logger.info('✔ Active transfer was skipped and remains intact on Drive & Mongo');

    // Expired transfer file must be deleted from Drive and removed from Mongo
    const expiredDriveExists = await driveProvider.exists(expiredDriveFileId);
    if (expiredDriveExists) {
      throw new Error(`Expired Drive file '${expiredDriveFileId}' was NOT deleted!`);
    }
    const expiredDoc = await TransferModel.findOne({ token: expiredTransfer.token });
    if (expiredDoc) {
      throw new Error('Expired transfer document in MongoDB was not removed!');
    }
    logger.info('✔ Expired transfer file was removed from Drive and record purged from Mongo');

    // Missing drive file transfer must still be removed from Mongo
    const missingDoc = await TransferModel.findOne({ token: missingDriveTransfer.token });
    if (missingDoc) {
      throw new Error('Transfer document with missing Drive file was not removed from Mongo!');
    }
    logger.info('✔ Transfer with missing Drive file was handled gracefully and purged from Mongo');

    // 6. Test Start & Stop Lifecycle (Graceful Shutdown)
    logger.info('Test 6: Scheduler Lifecycle & Graceful Shutdown');
    cleanupSchedulerService.start();
    cleanupSchedulerService.stop();
    logger.info('✔ Cleanup Scheduler start() and stop() lifecycle verified');

    // Cleanup active test transfer
    await transferService.deleteTransfer(activeTransfer.token);

    console.log('\n🎉 ALL CLEANUP SCHEDULER MODULE VERIFICATION TESTS PASSED SUCCESSFULLY 🎉\n');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('❌ Cleanup Module verification failed:', { error: msg });
    console.error('\n❌ Verification Failed:', msg);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

runCleanupModuleVerification();
