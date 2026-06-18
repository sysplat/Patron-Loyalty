import { z } from 'zod';
/** HTTPS/CDN logo or base64 data URL from tenant settings upload (stored in TEXT column). */
export declare const organizationLogoUrlSchema: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<"">, z.ZodString, z.ZodEffects<z.ZodString, string, string>]>>;
export declare const updateOrganizationSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    website: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    industry: z.ZodOptional<z.ZodString>;
    timezone: z.ZodOptional<z.ZodString>;
    country: z.ZodOptional<z.ZodString>;
    logoUrl: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<"">, z.ZodString, z.ZodEffects<z.ZodString, string, string>]>>;
    visitJourneysEnabled: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    timezone?: string | undefined;
    website?: string | undefined;
    industry?: string | undefined;
    country?: string | undefined;
    logoUrl?: string | undefined;
    visitJourneysEnabled?: boolean | undefined;
}, {
    name?: string | undefined;
    timezone?: string | undefined;
    website?: string | undefined;
    industry?: string | undefined;
    country?: string | undefined;
    logoUrl?: string | undefined;
    visitJourneysEnabled?: boolean | undefined;
}>;
//# sourceMappingURL=organization.validators.d.ts.map