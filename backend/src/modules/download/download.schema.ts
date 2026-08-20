import { z } from 'zod';

export const requestDownloadSchema = z.object({
  transferCode: z.string().min(1, { message: 'transferCode is required' }),
  password: z.string().optional(),
});

export type RequestDownloadInput = z.infer<typeof requestDownloadSchema>;
