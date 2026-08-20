import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import { transferController } from '../controllers/transfer.controller';
import { env } from '../../../config/env';

const uploadDir = path.resolve(process.cwd(), 'temp', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniquePrefix = `${Date.now()}_${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniquePrefix}_${path.basename(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: env.MAX_FILE_SIZE,
    files: env.MAX_FILES,
  },
});

const router = Router();

// POST /api/v1/transfers - Create transfer & upload files
router.post('/', upload.array('files', env.MAX_FILES), transferController.create);

// GET /api/v1/transfers/share/:shareId - Lookup metadata by Share ID
router.get('/share/:shareId', transferController.getByShareId);

// GET /api/v1/transfers/:token/download - Stream file download
router.get('/:token/download', transferController.download);

// GET /api/v1/transfers/:token/status - Get transfer status
router.get('/:token/status', transferController.getStatus);

// GET /api/v1/transfers/:token - Lookup metadata by transfer Token
router.get('/:token', transferController.getByToken);

// DELETE /api/v1/transfers/:token - Delete transfer
router.delete('/:token', transferController.delete);

export const transferRoutes = router;
