import { z } from 'zod';

export const initiateUploadSchema = z.object({
  fileName: z.string().min(1, { message: 'fileName is required' }),
  fileSize: z.number().positive({ message: 'fileSize must be positive' }),
  mimeType: z.string().optional(),
  chunkCount: z.number().int().positive().default(1),
  password: z.string().optional(),
  maxDownloads: z.number().int().positive().default(1),
  expiryMinutes: z.number().int().positive().default(10),
});

export type InitiateUploadInput = z.infer<typeof initiateUploadSchema>;
