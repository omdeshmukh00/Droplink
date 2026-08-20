import { z } from 'zod';

export const triggerCleanupSchema = z.object({
  force: z.boolean().default(false),
  olderThanMinutes: z.number().int().nonnegative().optional(),
});

export type TriggerCleanupInput = z.infer<typeof triggerCleanupSchema>;
