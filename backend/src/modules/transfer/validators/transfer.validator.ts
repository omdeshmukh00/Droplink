import path from 'path';
import { z } from 'zod';
import { FORBIDDEN_FILE_EXTENSIONS, TRANSFER_LIMITS } from '../constants/transfer.constants';
import { TransferValidationError } from '../errors/transfer.errors';
import { sanitizeFilename } from '../../../utils/sanitizeFilename';
import { logger } from '../../../utils/logger';
import { env } from '../../../config/env';

export const createTransferSchema = z.object({
  maxDownloads: z.coerce
    .number()
    .int()
    .min(TRANSFER_LIMITS.MIN_RECEIVER_LIMIT)
    .max(TRANSFER_LIMITS.MAX_RECEIVER_LIMIT)
    .optional()
    .default(TRANSFER_LIMITS.DEFAULT_MAX_DOWNLOADS),
  receiverLimitEnabled: z.preprocess(
    (val) => val === 'true' || val === true,
    z.boolean()
  ).optional().default(false),
  receiverLimit: z.coerce
    .number()
    .int()
    .min(TRANSFER_LIMITS.MIN_RECEIVER_LIMIT)
    .max(TRANSFER_LIMITS.MAX_RECEIVER_LIMIT)
    .optional(),
  expiryMinutes: z.coerce
    .number()
    .int()
    .min(TRANSFER_LIMITS.MIN_EXPIRY_MINUTES)
    .max(TRANSFER_LIMITS.MAX_EXPIRY_MINUTES)
    .optional()
    .default(TRANSFER_LIMITS.DEFAULT_EXPIRY_MINUTES),
});

export type CreateTransferInput = z.input<typeof createTransferSchema>;

/**
 * Validates array of uploaded files against security limits and forbidden extensions.
 */
export function validateUploadedFiles(files: Express.Multer.File[]): void {
  if (!files || files.length === 0) {
    throw new TransferValidationError('No files uploaded. Please attach at least one file.');
  }

  if (files.length > env.MAX_FILES) {
    throw new TransferValidationError(`Maximum file count exceeded. Allowed: ${env.MAX_FILES} files.`);
  }

  let totalSize = 0;

  for (const file of files) {
    file.originalname = sanitizeFilename(file.originalname);

    if (file.size > env.MAX_FILE_SIZE) {
      logger.warn('Security Event: Oversized file upload attempt blocked', {
        filename: file.originalname,
        size: file.size,
        maxSize: env.MAX_FILE_SIZE,
      });
      throw new TransferValidationError(
        `File '${file.originalname}' exceeds maximum allowed size of ${Math.round(env.MAX_FILE_SIZE / (1024 * 1024))}MB.`
      );
    }

    const ext = path.extname(file.originalname).toLowerCase();
    if (FORBIDDEN_FILE_EXTENSIONS.includes(ext as any)) {
      logger.warn('Security Event: Executable / forbidden file upload attempt blocked', {
        filename: file.originalname,
        extension: ext,
      });
      throw new TransferValidationError(`File '${file.originalname}' has a forbidden extension (${ext}).`);
    }

    totalSize += file.size;
  }

  const maxTransferSize = env.MAX_FILE_SIZE * 2.5; // Example transfer threshold
  if (totalSize > maxTransferSize) {
    throw new TransferValidationError(
      `Total transfer size exceeds maximum threshold of ${Math.round(maxTransferSize / (1024 * 1024))}MB.`
    );
  }
}
