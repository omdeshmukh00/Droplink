import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { cleanupService } from './cleanup.service';

export class CleanupController {
  public purge = asyncHandler(async (_req: Request, res: Response) => {
    const result = await cleanupService.purgeExpiredTransfers();
    return ApiResponse.success(res, result);
  });
}

export const cleanupController = new CleanupController();
