import { cleanupSchedulerService, CleanupSchedulerService } from './services/cleanupScheduler.service';
import { CleanupStatsDto } from './dto/cleanup.dto';

export class CleanupService {
  private readonly scheduler: CleanupSchedulerService;

  constructor(scheduler: CleanupSchedulerService = cleanupSchedulerService) {
    this.scheduler = scheduler;
  }

  public async purgeExpiredTransfers(): Promise<CleanupStatsDto> {
    return await this.scheduler.runCleanup();
  }

  public getStats(): CleanupStatsDto | null {
    return this.scheduler.getLastStats();
  }
}

export const cleanupService = new CleanupService();
export { cleanupSchedulerService, CleanupSchedulerService };
