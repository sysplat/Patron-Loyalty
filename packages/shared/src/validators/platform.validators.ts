import { z } from 'zod';
import { SYSTEM_ROLES } from '../constants/roles';
import { passwordSchema } from './auth.validators';

const impersonationRoleSchema = z.enum([
  SYSTEM_ROLES.OWNER,
  SYSTEM_ROLES.ADMIN,
  SYSTEM_ROLES.MANAGER,
  SYSTEM_ROLES.STAFF,
  SYSTEM_ROLES.VIEWER,
]);

export const bulkTenantSuspendSchema = z.object({
  organizationIds: z.array(z.string().uuid()).min(1),
  suspend: z.boolean(),
});

export const tenantSuspendSchema = z.object({
  suspend: z.boolean(),
});

export const tenantVisitJourneysSchema = z.object({
  visitJourneysEnabled: z.boolean(),
});

export const tenantAppointmentsSchema = z.object({
  appointmentsEnabled: z.boolean(),
});

export const tenantPatronCrmSchema = z.object({
  patronCrmEnabled: z.boolean(),
});

export const tenantPlanSlugSchema = z.object({
  planSlug: z.string().min(1).max(50),
});

export const createPlatformAdminSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  password: passwordSchema,
});

export const platformImpersonationSchema = z.object({
  orgId: z.string().uuid(),
  /** When set, enforces RBAC for that system role instead of full support bypass. */
  role: impersonationRoleSchema.optional(),
  /** Required for manager/staff/viewer simulation; auto-picked when omitted. */
  branchId: z.string().uuid().optional(),
});

export const platformDataPurgeDryRunSchema = z.object({
  orgId: z.string().uuid(),
});

export const platformDataPurgeSchema = z.object({
  orgId: z.string().uuid(),
  confirmation: z.string().min(1),
});

const platformAnnouncementPolicyFields = {
  deliveryMode: z.enum(['banner', 'modal', 'blocking']).optional(),
  dismissBehavior: z.enum(['allowed', 'disallowed']).optional(),
  requireAcknowledgment: z.boolean().optional(),
};

export const platformAnnouncementSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  type: z.string().min(1).max(50),
  ...platformAnnouncementPolicyFields,
});

export const updatePlatformAnnouncementSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(5000).optional(),
  type: z.string().min(1).max(50).optional(),
  isActive: z.boolean().optional(),
  ...platformAnnouncementPolicyFields,
});

export const updateTenantProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100).trim().optional(),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(120)
    .trim()
    .regex(
      /^[a-z0-9-]+$/,
      'Slug must be alphanumeric and contain only lowercase letters, numbers, and hyphens',
    )
    .optional(),
  website: z.string().url('Must be a valid URL').max(255).optional().or(z.literal('')).nullable(),
  industry: z.string().max(50).optional().nullable(),
  timezone: z.string().min(1, 'Timezone is required').max(50).optional(),
  country: z
    .string()
    .length(2, 'Country code must be exactly 2 characters (e.g. US)')
    .optional()
    .or(z.literal(''))
    .nullable(),
});
