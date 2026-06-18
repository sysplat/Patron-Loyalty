import { z } from 'zod';

export const uploadMetadataSchema = z.object({
  entityType: z.string().max(50).optional(),
  entityId: z.string().uuid().optional(),
});
