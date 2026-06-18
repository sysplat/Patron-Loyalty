import { z } from 'zod';
import { nullableOptionalDateTimeString, optionalDateTimeString } from './datetime';

export const createAnnouncementSchema = z.object({
  deliveryMode: z.enum(['banner', 'modal', 'blocking']).optional().default('banner'),
  dismissBehavior: z.enum(['allowed', 'disallowed']).optional().default('allowed'),
  requireAcknowledgment: z.boolean().optional().default(false),
  branchId: z.string().uuid().optional(),
  message: z.string().min(1).max(500),
  type: z.string().max(50).optional().default('info'),
  displayOnScreen: z.boolean().optional().default(false),
  activeFrom: optionalDateTimeString,
  activeUntil: optionalDateTimeString,
});

export const updateAnnouncementSchema = z.object({
  deliveryMode: z.enum(['banner', 'modal', 'blocking']).optional(),
  dismissBehavior: z.enum(['allowed', 'disallowed']).optional(),
  requireAcknowledgment: z.boolean().optional(),
  message: z.string().max(500).optional(),
  type: z.string().max(50).optional(),
  displayOnScreen: z.boolean().optional(),
  activeFrom: nullableOptionalDateTimeString,
  activeUntil: nullableOptionalDateTimeString,
});
