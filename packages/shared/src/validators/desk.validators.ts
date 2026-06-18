import { z } from 'zod';

export const createDeskSchema = z.object({
  branchId: z.string().uuid(),
  name: z.string().min(1).max(100).trim(),
  number: z.string().min(1).max(20).trim(),
});

export const updateDeskSchema = z.object({
  name: z.string().max(100).trim().optional(),
  status: z.enum(['open', 'closed', 'available', 'busy', 'offline']).optional(),
  defaultStationProfileId: z.string().uuid().nullable().optional(),
});

export const assignDeskSchema = z.object({
  userIds: z.array(z.string().uuid()),
});
