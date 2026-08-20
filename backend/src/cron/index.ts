import { cleanupSchedulerService } from '../modules/cleanup/services/cleanupScheduler.service';
import { logger } from '../utils/logger';

export const initCronJobs = () => {
  logger.info('⏰ Initializing Background Cron Schedulers...');
  cleanupSchedulerService.start();
};
