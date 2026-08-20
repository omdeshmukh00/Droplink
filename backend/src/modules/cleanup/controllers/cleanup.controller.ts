import { Request, Response } from 'express';
import { asyncHandler } from '../../../utils/asyncHandler';
import { ApiResponse } from '../../../utils/ApiResponse';
import { cleanupSchedulerService, CleanupSchedulerService } from '../services/cleanupScheduler.service';

export class CleanupController {
  private readonly scheduler: CleanupSchedulerService;

  constructor(scheduler: CleanupSchedulerService = cleanupSchedulerService) {
    this.scheduler = scheduler;
  }

  public getMetrics = asyncHandler(async (_req: Request, res: Response) => {
    const stats = this.scheduler.getLastStats();
    return ApiResponse.success(res, {
      active: true,
      lastStats: stats,
    });
  });

  public triggerManualCleanup = asyncHandler(async (_req: Request, res: Response) => {
    const stats = await this.scheduler.runCleanup();
    return ApiResponse.success(res, {
      message: 'Manual cleanup completed successfully',
      stats,
    });
  });
}

export const cleanupController = new CleanupController();
