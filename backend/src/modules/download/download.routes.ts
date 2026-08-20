import { Router } from 'express';
import { downloadController } from './download.controller';

const router = Router();

router.get('/:token', downloadController.download);
router.get('/:token/info', downloadController.getInfo);

export const downloadRoutes = router;
