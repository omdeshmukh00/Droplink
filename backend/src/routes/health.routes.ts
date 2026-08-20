import { Router, Request, Response } from 'express';
import { databaseService } from '../config/database';
import { HttpStatusCodes } from '../constants/httpStatusCodes';
import { ApiResponse } from '../utils/ApiResponse';
import { ErrorCodes } from '../constants/errorCodes';

const router = Router();

/**
 * @route   GET /health
 * @desc    Liveness probe checking process readiness
 * @access  Public
 */
router.get('/health', (_req: Request, res: Response) => {
  return res.status(HttpStatusCodes.OK).json({
    success: true,
    status: 'healthy',
  });
});

/**
 * @route   GET /ready
 * @desc    Readiness probe checking database connectivity
 * @access  Public
 */
router.get('/ready', (_req: Request, res: Response) => {
  const isDbReady = databaseService.isReady();

  if (!isDbReady) {
    return ApiResponse.error(
      res,
      'Database service is not ready',
      HttpStatusCodes.SERVICE_UNAVAILABLE,
      ErrorCodes.SERVICE_UNAVAILABLE
    );
  }

  return res.status(HttpStatusCodes.OK).json({
    success: true,
    status: 'ready',
    database: 'connected',
  });
});

export const healthRoutes = router;
