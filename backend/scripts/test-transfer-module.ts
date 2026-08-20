import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import multer from 'multer';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { transferService } from '../src/modules/transfer/services/transfer.service';
import { env } from '../src/config/env';
import { logger } from '../src/utils/logger';

// Helper mock for Express Multer file
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

async function runFullModuleVerification() {
  logger.info('🚀 Starting Transfer Module full verification suite...');

  try {
    // Connect to MongoDB
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(env.MONGODB_URI);
      logger.info('Connected to MongoDB for verification');
    }

    // 1. Single File Upload Test
    logger.info('Test 1: Single File Upload & Disk Cleanup Check');
    const singleContent = `Hello DropLink Transfer Module - ${Date.now()}`;
    const singleFile = createMockMulterFile('single-test.txt', singleContent);
    const initialTempPath = singleFile.path;

    const singleTransfer = await transferService.createTransfer([singleFile], {
      maxDownloads: 1,
      receiverLimitEnabled: true,
      receiverLimit: 1,
      expiryMinutes: 10,
    });

    console.log('\n--- Single Transfer Created ---');
    console.log('Token:', singleTransfer.token);
    console.log('Formatted Share ID:', singleTransfer.shareId);
    console.log('Transfer Type:', singleTransfer.transferType);
    console.log('Max Downloads:', singleTransfer.maxDownloads);

    // Verify raw shareId format in MongoDB (no dashes)
    if (singleTransfer.shareId.includes('-')) {
      logger.info('✔ Client Share ID is properly formatted with hyphens');
    } else {
      throw new Error('Client Share ID should contain hyphens!');
    }

    // Verify immediate local file cleanup
    if (fs.existsSync(initialTempPath)) {
      throw new Error(`Temp file was NOT deleted after upload: ${initialTempPath}`);
    }
    logger.info('✔ Temporary local file was deleted immediately after upload');

    // 2. Fetch by Token & Share ID
    logger.info('Test 2: Lookup by Token and Share ID');
    const fetchedByToken = await transferService.getTransferByToken(singleTransfer.token);
    if (fetchedByToken.token !== singleTransfer.token) {
      throw new Error('Token lookup mismatch!');
    }

    const fetchedByShareId = await transferService.getTransferByShareId(singleTransfer.shareId);
    if (fetchedByShareId.token !== singleTransfer.token) {
      throw new Error('Share ID lookup mismatch!');
    }
    logger.info('✔ Token and Share ID lookups succeeded');

    // 3. Multi-file ZIP Upload Test
    logger.info('Test 3: Multi-file Upload & ZIP Creation');
    const fileA = createMockMulterFile('docA.txt', 'Document A content');
    const fileB = createMockMulterFile('docB.txt', 'Document B content');
    const tempPathA = fileA.path;
    const tempPathB = fileB.path;

    const zipTransfer = await transferService.createTransfer([fileA, fileB], {
      maxDownloads: 2,
      expiryMinutes: 10,
    });

    console.log('\n--- ZIP Transfer Created ---');
    console.log('Token:', zipTransfer.token);
    console.log('Transfer Type:', zipTransfer.transferType);

    if (zipTransfer.transferType !== 'zip') {
      throw new Error('Expected transferType to be zip');
    }

    // Verify temp files cleanup
    if (fs.existsSync(tempPathA) || fs.existsSync(tempPathB)) {
      throw new Error('Temporary files were NOT cleaned up after ZIP upload!');
    }
    logger.info('✔ Multi-file ZIP created and temporary files cleaned up immediately');

    // 4. Status Check
    logger.info('Test 4: Transfer Status Check');
    const status = await transferService.getTransferStatus(zipTransfer.token);
    console.log('\n--- Transfer Status ---');
    console.log('Status:', status.status);
    console.log('Remaining Downloads:', status.remainingDownloads);
    console.log('Seconds Remaining:', status.secondsRemaining);

    if (status.status !== 'READY') {
      throw new Error(`Expected status READY, got ${status.status}`);
    }
    logger.info('✔ Transfer status check passed');

    // 5. Cleanup Test Transfer
    logger.info('Test 5: Delete Transfer & Cloud Cleanup');
    await transferService.deleteTransfer(singleTransfer.token);
    await transferService.deleteTransfer(zipTransfer.token);
    logger.info('✔ Transfers deleted successfully');

    console.log('\n🎉 ALL TRANSFER MODULE VERIFICATION TESTS PASSED SUCCESSFULLY 🎉\n');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('❌ Transfer module verification failed:', { error: message });
    console.error('\n❌ Verification Failed:', message);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

runFullModuleVerification();
