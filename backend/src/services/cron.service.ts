import cron, { ScheduledTask } from 'node-cron';
import { logger } from '../utils/logger';

export class CronService {
  private static instance: CronService;
  private tasks: Map<string, ScheduledTask> = new Map();

  private constructor() {}

  public static getInstance(): CronService {
    if (!CronService.instance) {
      CronService.instance = new CronService();
    }
    return CronService.instance;
  }

  public registerTask(name: string, cronExpression: string, taskFunction: () => void | Promise<void>): void {
    if (this.tasks.has(name)) {
      logger.warn(`⏰ Cron task '${name}' is already registered.`);
      return;
    }

    const task = cron.schedule(cronExpression, async () => {
      logger.info(`⏰ Executing scheduled cron task: [${name}]`);
      try {
        await taskFunction();
      } catch (error) {
        logger.error(`❌ Error in cron task [${name}]:`, error);
      }
    });

    this.tasks.set(name, task);
    logger.info(`⏰ Registered cron task: [${name}] with schedule '${cronExpression}'`);
  }

  public startAll(): void {
    logger.info('⏰ Cron Scheduler service initialized');
  }

  public stopAll(): void {
    this.tasks.forEach((task, name) => {
      task.stop();
      logger.info(`⏰ Stopped cron task: [${name}]`);
    });
    this.tasks.clear();
  }
}

export const cronService = CronService.getInstance();
