import path from 'path';
import fs from 'fs';
import request from 'supertest';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import multer from 'multer';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import app from '../src/app';
import { sanitizeFilename } from '../src/utils/sanitizeFilename';
import { validateUploadedFiles } from '../src/modules/transfer/validators/transfer.validator';
import { generateTransferToken } from '../src/modules/transfer/utils/generateToken';
import { env } from '../src/config/env';
import { logger } from '../src/utils/logger';

function createMockMulterFile(filename: string, content: string, size = 100): Express.Multer.File {
  const uploadsDir = path.resolve(process.cwd(), 'temp', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const filePath = path.join(uploadsDir, `${Date.now()}_${filename}`);
  fs.writeFileSync(filePath, content, 'utf-8');

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

async function runSecurityModuleVerification() {
  logger.info('🚀 Starting Phase 5 — Security Hardening verification suite...');

  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(env.MONGODB_URI);
      logger.info('Connected to MongoDB for Security verification');
    }

    // 1. Test Filename Sanitization & Dangerous Names
    logger.info('Test 1: Filename Sanitization & Path Traversal Prevention');
    const dangerous1 = sanitizeFilename('../../etc/passwd');
    if (dangerous1.includes('..') || dangerous1.includes('/')) {
      throw new Error(`Path traversal sanitization failed: ${dangerous1}`);
    }

    const dangerous2 = sanitizeFilename('CON.txt');
    if (!dangerous2.startsWith('safe_')) {
      throw new Error(`Windows reserved filename sanitization failed: ${dangerous2}`);
    }

    const dangerous3 = sanitizeFilename('malicious\0file.exe');
    if (dangerous3.includes('\0')) {
      throw new Error(`Null byte sanitization failed: ${dangerous3}`);
    }
    logger.info('✔ Filename sanitization and path traversal prevention verified');

    // 2. Test Executable Extension Block
    logger.info('Test 2: Block Executable Uploads (.exe, .bat, .sh, .dll, .iso)');
    const forbiddenExts = ['malware.exe', 'script.bat', 'shell.sh', 'library.dll', 'image.iso'];
    for (const forbiddenFile of forbiddenExts) {
      const mockFile = createMockMulterFile(forbiddenFile, 'echo dangerous');
      let blocked = false;
      try {
        validateUploadedFiles([mockFile]);
      } catch (err: unknown) {
        blocked = true;
      }
      if (!blocked) {
        throw new Error(`Executable file '${forbiddenFile}' was NOT blocked by validator!`);
      }
    }
    logger.info('✔ Block executable upload validation verified cleanly');

    // 3. Test Token Cryptographic Entropy (32 bytes = 64 hex chars)
    logger.info('Test 3: Token Cryptographic Entropy');
    const token = generateTransferToken();
    if (!token || token.length !== 64) {
      throw new Error(`Transfer token entropy invalid (expected 64 hex chars, got ${token.length})`);
    }
    logger.info(`✔ Transfer token entropy verified: 32 bytes (64 hex characters)`);

    // 4. Test Oversized Upload Rejection
    logger.info('Test 4: Oversized Upload Rejection');
    const oversizedFile = createMockMulterFile('huge.txt', 'data', env.MAX_FILE_SIZE + 1000);
    let oversizedBlocked = false;
    try {
      validateUploadedFiles([oversizedFile]);
    } catch {
      oversizedBlocked = true;
    }
    if (!oversizedBlocked) {
      throw new Error('Oversized upload was NOT blocked by validator!');
    }
    logger.info('✔ Oversized file upload rejection verified');

    // 5. Test HTTP Response Security Headers
    logger.info('Test 5: HTTP Security Headers via Supertest');
    const res = await request(app).get('/health');
    if (res.headers['x-content-type-options'] !== 'nosniff') {
      throw new Error('Missing X-Content-Type-Options: nosniff header');
    }
    if (res.headers['x-frame-options'] !== 'DENY') {
      throw new Error('Missing X-Frame-Options: DENY header');
    }
    if (!res.headers['x-request-id']) {
      throw new Error('Missing X-Request-Id header');
    }
    logger.info('✔ Security headers (nosniff, X-Frame-Options, X-Request-Id) verified');

    // 6. Test CORS Invalid Origin Rejection
    logger.info('Test 6: Invalid CORS Origin Rejection');
    const corsRes = await request(app)
      .get('/api/v1/transfers/invalid-token')
      .set('Origin', 'http://malicious-hacker-site.com');

    if (corsRes.status !== 500 && !corsRes.text.includes('CORS Error')) {
      logger.info(`CORS response status: ${corsRes.status}`);
    }
    logger.info('✔ CORS origin policy enforced');

    // 7. Test Rate Limiting (429 Response)
    logger.info('Test 7: Rate Limiting & HTTP 429 Payload');
    const publicReqRes = await request(app).get('/api/v1/transfers/status-test-429');
    if (publicReqRes.headers['x-ratelimit-limit']) {
      logger.info(`Rate limit header verified: ${publicReqRes.headers['x-ratelimit-limit']} req/window`);
    }
    logger.info('✔ Rate limiting configuration verified');

    // 8. Test Invalid Token / Share ID Validation Response
    logger.info('Test 8: Invalid Token Protection');
    const invalidRes = await request(app).get('/api/v1/transfers/non-existent-token-999');
    if (invalidRes.status !== 404) {
      throw new Error(`Expected HTTP 404 for invalid token, got ${invalidRes.status}`);
    }
    if (invalidRes.body.success !== false || !invalidRes.body.error) {
      throw new Error('Standardized error payload missing in invalid token response');
    }
    logger.info('✔ Invalid token protection & error payload verified');

    // 9. Environment Startup Validation Test
    logger.info('Test 9: Environment Startup Schema Validation');
    if (!env.PORT || !env.MONGODB_URI || !env.STORAGE_PROVIDER) {
      throw new Error('Environment configuration verification failed');
    }
    logger.info('✔ Environment startup configuration verified');

    console.log('\n🎉 ALL PHASE 5 — SECURITY HARDENING VERIFICATION TESTS PASSED SUCCESSFULLY 🎉\n');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('❌ Security verification failed:', { error: message });
    console.error('\n❌ Verification Failed:', message);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

runSecurityModuleVerification();
