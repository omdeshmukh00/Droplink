import { Router, Request, Response } from 'express';
import { databaseService } from '../config/database';
import { prisma } from '../config/prisma';
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
router.get('/ready', async (_req: Request, res: Response) => {
  let isPrismaReady = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    isPrismaReady = true;
  } catch {
    isPrismaReady = false;
  }

  const isMongoReady = databaseService.isReady();

  if (!isPrismaReady && !isMongoReady) {
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
    database: isPrismaReady ? 'postgresql' : 'mongodb',
    postgresql: isPrismaReady ? 'connected' : 'disconnected',
    mongodb: isMongoReady ? 'connected' : 'disconnected',
  });
});

export const healthRoutes = router;
