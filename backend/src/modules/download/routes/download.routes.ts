import { Router } from 'express';
import { downloadController } from '../controllers/download.controller';

const router = Router();

// GET /api/v1/download/share/:shareId - Receiver lookup by Share ID
router.get('/share/:shareId', downloadController.getByShareId);

// GET /api/v1/download/:token/download - Stream download
router.get('/:token/download', downloadController.download);

// GET /api/v1/download/:token/status - Get status
router.get('/:token/status', downloadController.getStatus);

// GET /api/v1/download/:token - Stream download directly
router.get('/:token', downloadController.download);

export const downloadRoutes = router;
