import { Router } from 'express';
import { cleanupController } from '../controllers/cleanup.controller';

const router = Router();

// GET /api/v1/cleanup/metrics - Get latest cleanup metrics
router.get('/metrics', cleanupController.getMetrics);

// POST /api/v1/cleanup/trigger - Trigger manual cleanup
router.post('/trigger', cleanupController.triggerManualCleanup);

export const cleanupRoutes = router;
