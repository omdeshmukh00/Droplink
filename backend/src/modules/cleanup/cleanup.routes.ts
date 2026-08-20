import { Router } from 'express';
import { cleanupController } from './cleanup.controller';

const router = Router();

router.post('/purge', cleanupController.purge);

export const cleanupRoutes = router;
