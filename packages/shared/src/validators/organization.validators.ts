import { z } from 'zod';
import {
  ORGANIZATION_LOGO_MAX_DATA_URL_LENGTH,
  ORGANIZATION_LOGO_MAX_UPLOAD_LABEL,
} from '../constants/organization-logo';

/** HTTPS/CDN logo or base64 data URL from tenant settings upload (stored in TEXT column). */
export const organizationLogoUrlSchema = z
  .union([
    z.literal(''),
    z.string().url().max(2048),
    z
      .string()
      .max(ORGANIZATION_LOGO_MAX_DATA_URL_LENGTH, {
        message: `Logo must be ${ORGANIZATION_LOGO_MAX_UPLOAD_LABEL} or smaller`,
      })
      .refine((value) => value.startsWith('data:image/'), {
        message: 'Logo must be a PNG, JPEG, GIF, WebP, or SVG image',
      }),
  ])
  .optional();

export const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  website: z.string().url().max(500).optional().or(z.literal('')),
  industry: z.string().max(100).optional(),
  timezone: z.string().min(1).optional(),
  country: z.string().max(100).optional(),
  logoUrl: organizationLogoUrlSchema,
  visitJourneysEnabled: z.boolean().optional(),
});
