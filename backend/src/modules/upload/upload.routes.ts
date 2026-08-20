import { Router } from 'express';
import multer from 'multer';
import { transferController } from '../transfer/transfer.controller';
import { env } from '../../config/env';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.MAX_FILE_SIZE,
    files: env.MAX_FILES,
  },
});

const router = Router();

router.post('/', upload.array('files', env.MAX_FILES), transferController.create);

export const uploadRoutes = router;
