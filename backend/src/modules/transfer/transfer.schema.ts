import { z } from 'zod';

export const createTransferOptionsSchema = z.object({
  maxDownloads: z.coerce.number().int().min(1).max(100).optional().default(1),
  maxUsers: z.coerce.number().int().min(1).max(100).optional(),
  expiryMinutes: z.coerce.number().int().min(1).max(1440).optional().default(10),
}).transform((data) => ({
  maxDownloads: data.maxUsers ?? data.maxDownloads ?? 1,
  expiryMinutes: data.expiryMinutes ?? 10,
}));

export type CreateTransferOptions = z.infer<typeof createTransferOptionsSchema>;

export interface QRPayload {
  shareUrl: string;
  shareId: string;
  transferToken: string;
}

export interface TransferResponseData {
  token: string;
  shareId: string; // Formatted shareId (e.g. ABC-92L-KJD)
  shareUrl: string;
  qrPayload: QRPayload;
  files: Array<{
    originalName: string;
    size: number;
    mimeType: string;
  }>;
  totalSize: number;
  isZip: boolean;
  status: string;
  expiresAt: string;
  downloadCount: number;
  maxDownloads: number;
  remainingDownloads: number;
  createdAt: string;
}
