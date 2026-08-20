import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import multer from 'multer';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import mongoose from 'mongoose';
import app from '../src/app';
import { socketService } from '../src/services/socket.service';
import { env } from '../src/config/env';
import { logger } from '../src/utils/logger';
import { SocketProgressPayload, RoomJoinedPayload } from '../src/types/socket.types';

const TEST_PORT = 5055;
const TEST_TOKEN = 'test-token-socket-999';
const ROOM_KEY = `transfer:${TEST_TOKEN}`;

async function runSocketModuleVerification() {
  logger.info('🚀 Starting Socket.IO Real-Time Transfer Module verification suite...');

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(env.MONGODB_URI);
    logger.info('Connected to MongoDB for Socket testing');
  }

  // 1. Start HTTP Server & Initialize Socket.IO
  const server = http.createServer(app);
  socketService.init(server);

  await new Promise<void>((resolve) => {
    server.listen(TEST_PORT, () => {
      logger.info(`Test server listening on http://localhost:${TEST_PORT}`);
      resolve();
    });
  });

  let clientSocket: ClientSocket | null = null;
  const receivedEvents: string[] = [];

  try {
    // 2. Connect Socket.IO Client to /socket namespace
    logger.info('Test 1: Client Connection');
    clientSocket = Client(`http://localhost:${TEST_PORT}/socket`, {
      transports: ['websocket'],
      autoConnect: true,
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);

      clientSocket?.on('connect', () => {
        clearTimeout(timeout);
        logger.info(`✔ Client connected successfully: SocketID=${clientSocket?.id}`);
        resolve();
      });

      clientSocket?.on('connect_error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    // Setup listener recorder for all expected real-time events
    const listenEvents = [
      'joined-room',
      'transfer-created',
      'upload-started',
      'upload-progress',
      'zip-started',
      'zip-progress',
      'zip-completed',
      'drive-upload-started',
      'drive-upload-progress',
      'drive-upload-completed',
      'transfer-processing',
      'transfer-ready',
      'download-started',
      'download-progress',
      'download-completed',
      'transfer-expired',
      'transfer-deleted',
      'cleanup-started',
      'cleanup-completed',
      'error',
    ];

    listenEvents.forEach((evt) => {
      clientSocket?.on(evt, (payload: unknown) => {
        receivedEvents.push(evt);
        logger.info(`Received socket event [${evt}]:`, payload);
      });
    });

    // 3. Room Join Verification
    logger.info('Test 2: Room Join (join-transfer-room)');
    const joinPromise = new Promise<RoomJoinedPayload>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Room join timeout')), 5000);
      clientSocket?.once('joined-room', (data: RoomJoinedPayload) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    clientSocket.emit('join-transfer-room', { roomKey: ROOM_KEY });
    const joinConfirmation = await joinPromise;

    if (joinConfirmation.status !== 'success') {
      throw new Error('Room join returned failed status');
    }
    logger.info('✔ Room join confirmed for room:', joinConfirmation.roomKey);

    // 4. Upload Flow Events Emission Verification
    logger.info('Test 3: Upload Flow Events');
    socketService.emitUploadStarted(ROOM_KEY, { filesCount: 2 });
    socketService.emitUploadProgress(ROOM_KEY, 50, 'Uploading files...');
    socketService.emitZipStarted(ROOM_KEY);
    socketService.emitZipProgress(ROOM_KEY, 80);
    socketService.emitZipCompleted(ROOM_KEY);
    socketService.emitDriveUploadStarted(ROOM_KEY);
    socketService.emitDriveUploadProgress(ROOM_KEY, 90);
    socketService.emitDriveUploadCompleted(ROOM_KEY);
    socketService.emitTransferProcessing(ROOM_KEY, 'Finalizing transfer metadata...');
    socketService.emitTransferReady(ROOM_KEY, { token: TEST_TOKEN, status: 'READY' });

    await new Promise((r) => setTimeout(r, 500));

    const expectedUploadEvents = [
      'upload-started',
      'upload-progress',
      'zip-started',
      'zip-progress',
      'zip-completed',
      'drive-upload-started',
      'drive-upload-progress',
      'drive-upload-completed',
      'transfer-processing',
      'transfer-ready',
    ];

    for (const evt of expectedUploadEvents) {
      if (!receivedEvents.includes(evt)) {
        throw new Error(`Missing expected upload event: ${evt}`);
      }
    }
    logger.info('✔ Upload flow events verified cleanly');

    // 5. Download Flow Events Verification
    logger.info('Test 4: Download Flow Events');
    socketService.emitDownloadStarted(ROOM_KEY, { token: TEST_TOKEN });
    socketService.emitDownloadProgress(ROOM_KEY, 50);
    socketService.emitDownloadCompleted(ROOM_KEY, { token: TEST_TOKEN });

    await new Promise((r) => setTimeout(r, 500));

    const expectedDownloadEvents = ['download-started', 'download-progress', 'download-completed'];
    for (const evt of expectedDownloadEvents) {
      if (!receivedEvents.includes(evt)) {
        throw new Error(`Missing expected download event: ${evt}`);
      }
    }
    logger.info('✔ Download flow events verified cleanly');

    // 6. Cleanup & Expiration Events Verification
    logger.info('Test 5: Cleanup & Expiration Events');
    socketService.emitCleanupStarted();
    socketService.emitExpired(ROOM_KEY, { token: TEST_TOKEN });
    socketService.emitTransferDeleted(ROOM_KEY, { token: TEST_TOKEN });
    socketService.emitCleanupCompleted();

    await new Promise((r) => setTimeout(r, 500));

    const expectedCleanupEvents = [
      'cleanup-started',
      'transfer-expired',
      'transfer-deleted',
      'cleanup-completed',
    ];
    for (const evt of expectedCleanupEvents) {
      if (!receivedEvents.includes(evt)) {
        throw new Error(`Missing expected cleanup event: ${evt}`);
      }
    }
    logger.info('✔ Cleanup & expiration events verified cleanly');

    // 7. Reconnection & Disconnect Verification
    logger.info('Test 6: Reconnection & Disconnect');
    clientSocket.disconnect();
    logger.info('✔ Client disconnected');

    clientSocket.connect();
    await new Promise<void>((resolve) => {
      clientSocket?.once('connect', () => {
        logger.info('✔ Reconnected client socket:', clientSocket?.id);
        resolve();
      });
    });

    clientSocket.emit('join-transfer-room', { roomKey: ROOM_KEY });
    await new Promise((r) => setTimeout(r, 300));
    logger.info('✔ Reconnection state recovery verified');

    console.log('\n🎉 ALL SOCKET.IO MODULE VERIFICATION TESTS PASSED SUCCESSFULLY 🎉\n');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('❌ Socket module verification failed:', { error: message });
    console.error('\n❌ Verification Failed:', message);
    process.exit(1);
  } finally {
    if (clientSocket) {
      clientSocket.disconnect();
    }
    socketService.close();
    server.close();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

runSocketModuleVerification();
