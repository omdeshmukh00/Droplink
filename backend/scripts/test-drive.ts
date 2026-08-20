import path from 'path';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import dotenv from 'dotenv';

// Load environment variables from .env file in backend directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { GoogleDriveStorageProvider } from '../src/storage/providers/GoogleDriveStorageProvider';
import { logger } from '../src/utils/logger';

async function runDriveIntegrationTest() {
  const testFileName = 'test.txt';
  const downloadedFileName = 'downloaded-test.txt';
  const testFilePath = path.resolve(__dirname, testFileName);
  const downloadedFilePath = path.resolve(__dirname, downloadedFileName);

  const testContent = `DropLink Google Drive Integration Test - ${new Date().toISOString()}`;
  let uploadedFileId: string | null = null;
  let testProvider: GoogleDriveStorageProvider | null = null;

  logger.info('Starting Google Drive end-to-end integration test...');

  try {
    // 1. Create temporary text file named test.txt
    fs.writeFileSync(testFilePath, testContent, 'utf-8');
    logger.info(`1. Created local temporary test file at '${testFilePath}'`);

    // Instantiate GoogleDriveStorageProvider
    testProvider = new GoogleDriveStorageProvider();

    // 2. Upload it using GoogleDriveStorageProvider
    logger.info('2. Uploading test file to Google Drive...');
    const uploadResult = await testProvider.upload(testFilePath, testFileName, 'text/plain');
    uploadedFileId = uploadResult.fileId;

    // 3. Print the returned Google Drive File ID
    console.log('\n====================================');
    console.log(`Uploaded Google Drive File ID: ${uploadedFileId}`);
    console.log('====================================\n');
    logger.info(`3. Returned Google Drive File ID: ${uploadedFileId}`);

    // 4. Read and print file metadata
    logger.info('4. Fetching file metadata from Google Drive...');
    const metadata = await testProvider.getMetadata(uploadedFileId);
    console.log('File Metadata:', JSON.stringify(metadata, null, 2));
    logger.info('4. File Metadata retrieved successfully', { metadata });

    // 5 & 6. Download the file as a stream and save locally as downloaded-test.txt
    logger.info('5 & 6. Downloading file stream from Google Drive...');
    const downloadStream = await testProvider.download(uploadedFileId);
    const writeStream = fs.createWriteStream(downloadedFilePath);

    await pipeline(downloadStream, writeStream);
    logger.info(`6. File saved locally to '${downloadedFilePath}'`);

    // 7. Verify downloaded content
    const downloadedContent = fs.readFileSync(downloadedFilePath, 'utf-8');
    if (downloadedContent !== testContent) {
      throw new Error(`Content mismatch! Expected '${testContent}', received '${downloadedContent}'`);
    }
    logger.info('7. Downloaded file content verified successfully matching original content');

    // 8. Delete file from Google Drive and verify non-existence
    logger.info('8. Deleting file from Google Drive...');
    await testProvider.delete(uploadedFileId);

    const existsAfterDelete = await testProvider.exists(uploadedFileId);
    if (existsAfterDelete) {
      throw new Error(`File '${uploadedFileId}' still exists in Google Drive after deletion`);
    }
    logger.info('8. Confirmed file deletion from Google Drive');
    uploadedFileId = null;

    // 10. Print "Google Drive integration successful" if every step succeeds
    console.log('\nGoogle Drive integration successful\n');
    logger.info('Google Drive integration successful');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Google Drive integration test failed', { error: errorMessage });
    console.error(`\n❌ Test Failed: ${errorMessage}\n`);

    // Attempt cleanup on Google Drive if file was uploaded before failure
    if (testProvider && uploadedFileId) {
      try {
        logger.info(`Attempting cleanup of Google Drive file '${uploadedFileId}' after failure...`);
        await testProvider.delete(uploadedFileId);
      } catch (cleanupError) {
        logger.warn(`Cleanup failed for Google Drive file '${uploadedFileId}'`, { error: cleanupError });
      }
    }

    process.exit(1);
  } finally {
    // 9. Delete temporary local files
    logger.info('9. Cleaning up temporary local test files...');
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
    if (fs.existsSync(downloadedFilePath)) {
      fs.unlinkSync(downloadedFilePath);
    }
    logger.info('9. Local temporary test files cleaned up successfully');
  }
}

runDriveIntegrationTest();
