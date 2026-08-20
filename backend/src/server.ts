import http from 'http';
import app from './app';
import { env } from './config/env';
import { databaseService } from './config/database';
import { initSockets } from './sockets';
import { initCronJobs } from './cron';
import { socketService } from './services/socket.service';
import { cronService } from './services/cron.service';
import { cleanupSchedulerService } from './modules/cleanup/services/cleanupScheduler.service';
import { logger } from './utils/logger';

async function bootstrap() {
  logger.info('🚀 Initializing LinkDrop Backend Core Services...');

  // 1. Connect to MongoDB Atlas
  await databaseService.connect();

  // 2. Create HTTP Server
  const server = http.createServer(app);

  // 3. Initialize Socket.IO (/socket namespace)
  initSockets(server);

  // 4. Initialize Cron Jobs
  initCronJobs();

  // 5. Start HTTP Server Listening
  server.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`✨ LinkDrop Server active on http://0.0.0.0:${env.PORT} [Environment: ${env.NODE_ENV}]`);
  });

  // Graceful Shutdown Logic
  let isShuttingDown = false;

  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`⚠️ Received ${signal}. Starting graceful shutdown...`);

    // Force exit after 10s timeout
    const forceExitTimeout = setTimeout(() => {
      logger.error('❌ Shutdown timed out. Forcing process exit.');
      process.exit(1);
    }, 10000);

    try {
      // 1. Close HTTP server accepting new connections
      server.close(() => {
        logger.info('🌐 HTTP server closed.');
      });

      // 2. Terminate WebSockets
      socketService.close();

      // 3. Stop Cron Jobs & Cleanup Scheduler
      cronService.stopAll();
      cleanupSchedulerService.stop();

      // 4. Close MongoDB Connection
      await databaseService.disconnect();

      clearTimeout(forceExitTimeout);
      logger.info('✅ LinkDrop Backend shut down cleanly.');
      process.exit(0);
    } catch (error) {
      logger.error('❌ Error during graceful shutdown:', error);
      process.exit(1);
    }
  };

  // Signal Listeners
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  process.on('unhandledRejection', (reason: any) => {
    logger.error('💥 Unhandled Promise Rejection:', reason);
    gracefulShutdown('unhandledRejection');
  });

  process.on('uncaughtException', (error: Error) => {
    logger.error('💥 Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
  });
}

bootstrap().catch((err) => {
  logger.error('❌ Fatal error during bootstrap:', err);
  process.exit(1);
});
