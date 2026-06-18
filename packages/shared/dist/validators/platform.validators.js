"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTenantProfileSchema = exports.updatePlatformAnnouncementSchema = exports.platformAnnouncementSchema = exports.platformDataPurgeSchema = exports.platformDataPurgeDryRunSchema = exports.platformImpersonationSchema = exports.createPlatformAdminSchema = exports.tenantPlanSlugSchema = exports.tenantPatronCrmSchema = exports.tenantAppointmentsSchema = exports.tenantVisitJourneysSchema = exports.tenantSuspendSchema = exports.bulkTenantSuspendSchema = void 0;
const zod_1 = require("zod");
const roles_1 = require("../constants/roles");
const auth_validators_1 = require("./auth.validators");
const impersonationRoleSchema = zod_1.z.enum([
    roles_1.SYSTEM_ROLES.OWNER,
    roles_1.SYSTEM_ROLES.ADMIN,
    roles_1.SYSTEM_ROLES.MANAGER,
    roles_1.SYSTEM_ROLES.STAFF,
    roles_1.SYSTEM_ROLES.VIEWER,
]);
exports.bulkTenantSuspendSchema = zod_1.z.object({
    organizationIds: zod_1.z.array(zod_1.z.string().uuid()).min(1),
    suspend: zod_1.z.boolean(),
});
exports.tenantSuspendSchema = zod_1.z.object({
    suspend: zod_1.z.boolean(),
});
exports.tenantVisitJourneysSchema = zod_1.z.object({
    visitJourneysEnabled: zod_1.z.boolean(),
});
exports.tenantAppointmentsSchema = zod_1.z.object({
    appointmentsEnabled: zod_1.z.boolean(),
});
exports.tenantPatronCrmSchema = zod_1.z.object({
    patronCrmEnabled: zod_1.z.boolean(),
});
exports.tenantPlanSlugSchema = zod_1.z.object({
    planSlug: zod_1.z.string().min(1).max(50),
});
exports.createPlatformAdminSchema = zod_1.z.object({
    email: zod_1.z.string().email().toLowerCase().trim(),
    firstName: zod_1.z.string().min(1).max(100).trim(),
    lastName: zod_1.z.string().min(1).max(100).trim(),
    password: auth_validators_1.passwordSchema,
});
exports.platformImpersonationSchema = zod_1.z.object({
    orgId: zod_1.z.string().uuid(),
    /** When set, enforces RBAC for that system role instead of full support bypass. */
    role: impersonationRoleSchema.optional(),
    /** Required for manager/staff/viewer simulation; auto-picked when omitted. */
    branchId: zod_1.z.string().uuid().optional(),
});
exports.platformDataPurgeDryRunSchema = zod_1.z.object({
    orgId: zod_1.z.string().uuid(),
});
exports.platformDataPurgeSchema = zod_1.z.object({
    orgId: zod_1.z.string().uuid(),
    confirmation: zod_1.z.string().min(1),
});
const platformAnnouncementPolicyFields = {
    deliveryMode: zod_1.z.enum(['banner', 'modal', 'blocking']).optional(),
    dismissBehavior: zod_1.z.enum(['allowed', 'disallowed']).optional(),
    requireAcknowledgment: zod_1.z.boolean().optional(),
};
exports.platformAnnouncementSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(200),
    body: zod_1.z.string().min(1).max(5000),
    type: zod_1.z.string().min(1).max(50),
    ...platformAnnouncementPolicyFields,
});
exports.updatePlatformAnnouncementSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(200).optional(),
    body: zod_1.z.string().min(1).max(5000).optional(),
    type: zod_1.z.string().min(1).max(50).optional(),
    isActive: zod_1.z.boolean().optional(),
    ...platformAnnouncementPolicyFields,
});
exports.updateTenantProfileSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required').max(100).trim().optional(),
    slug: zod_1.z
        .string()
        .min(1, 'Slug is required')
        .max(120)
        .trim()
        .regex(/^[a-z0-9-]+$/, 'Slug must be alphanumeric and contain only lowercase letters, numbers, and hyphens')
        .optional(),
    website: zod_1.z.string().url('Must be a valid URL').max(255).optional().or(zod_1.z.literal('')).nullable(),
    industry: zod_1.z.string().max(50).optional().nullable(),
    timezone: zod_1.z.string().min(1, 'Timezone is required').max(50).optional(),
    country: zod_1.z
        .string()
        .length(2, 'Country code must be exactly 2 characters (e.g. US)')
        .optional()
        .or(zod_1.z.literal(''))
        .nullable(),
});
//# sourceMappingURL=platform.validators.js.map