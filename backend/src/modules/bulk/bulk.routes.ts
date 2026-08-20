import { Router } from 'express';
import { bulkController } from './controllers/bulk.controller';

const router = Router();

// REST Endpoints
router.post('/sessions', bulkController.createSession);
router.get('/sessions/:bulkCode', bulkController.getSessionInfo);
router.post('/sessions/:sessionId/join', bulkController.joinSession);
router.get('/sessions/:sessionId/status', bulkController.getSessionStatus);
router.delete('/sessions/:sessionId', bulkController.endSession);

export const bulkRoutes = router;
