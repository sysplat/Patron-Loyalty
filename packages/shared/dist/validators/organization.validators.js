"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOrganizationSchema = exports.organizationBrandColorSchema = exports.organizationLogoUrlSchema = void 0;
const zod_1 = require("zod");
const organization_logo_1 = require("../constants/organization-logo");
/** HTTPS/CDN logo or base64 data URL from tenant settings upload (stored in TEXT column). */
exports.organizationLogoUrlSchema = zod_1.z
    .union([
    zod_1.z.literal(''),
    zod_1.z.string().url().max(2048),
    zod_1.z
        .string()
        .max(organization_logo_1.ORGANIZATION_LOGO_MAX_DATA_URL_LENGTH, {
        message: `Logo must be ${organization_logo_1.ORGANIZATION_LOGO_MAX_UPLOAD_LABEL} or smaller`,
    })
        .refine((value) => value.startsWith('data:image/'), {
        message: 'Logo must be a PNG, JPEG, GIF, WebP, or SVG image',
    }),
])
    .optional();
/** Optional `#RRGGBB` brand color; empty string clears. */
exports.organizationBrandColorSchema = zod_1.z
    .union([
    zod_1.z.literal(''),
    zod_1.z.null(),
    zod_1.z.string().regex(/^#[0-9A-Fa-f]{6}$/, { message: 'Color must be #RRGGBB' }),
])
    .optional();
exports.updateOrganizationSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(200).trim().optional(),
    website: zod_1.z.string().url().max(500).optional().or(zod_1.z.literal('')),
    industry: zod_1.z.string().max(100).optional(),
    timezone: zod_1.z.string().min(1).optional(),
    country: zod_1.z.string().max(100).optional(),
    logoUrl: exports.organizationLogoUrlSchema,
    brandPrimaryColor: exports.organizationBrandColorSchema,
    brandAccentColor: exports.organizationBrandColorSchema,
    visitJourneysEnabled: zod_1.z.boolean().optional(),
});
//# sourceMappingURL=organization.validators.js.map