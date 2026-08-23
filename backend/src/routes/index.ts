import { Router } from 'express';
import { healthRoutes } from './health.routes';
import { uploadRoutes } from '../modules/upload/upload.routes';
import { downloadRoutes } from '../modules/download/download.routes';
import { transferRoutes } from '../modules/transfer/transfer.routes';
import { cleanupRoutes } from '../modules/cleanup/cleanup.routes';
import { bulkRoutes } from '../modules/bulk/bulk.routes';
import { webRtcRoutes } from '../modules/webrtc/webrtc.routes';

const router = Router();

// Mount root health checks
router.use('/', healthRoutes);

// Mount module feature routes under /api/v1
router.use('/transfers', transferRoutes);
router.use('/transfer', transferRoutes);
router.use('/upload', uploadRoutes);
router.use('/download', downloadRoutes);
router.use('/cleanup', cleanupRoutes);
router.use('/bulk', bulkRoutes);
router.use('/webrtc', webRtcRoutes);

export const v1Routes = router;
