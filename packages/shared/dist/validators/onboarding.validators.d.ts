import { z } from 'zod';
export declare const onboardingModulesSchema: z.ZodObject<{
    modules: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    modules: string[];
}, {
    modules: string[];
}>;
export declare const onboardingCompanyProfileSchema: z.ZodObject<{
    name: z.ZodString;
    website: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    industry: z.ZodString;
    timezone: z.ZodString;
    country: z.ZodString;
    logoUrl: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<"">, z.ZodString, z.ZodEffects<z.ZodString, string, string>]>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    timezone: string;
    industry: string;
    country: string;
    website?: string | undefined;
    logoUrl?: string | undefined;
}, {
    name: string;
    timezone: string;
    industry: string;
    country: string;
    website?: string | undefined;
    logoUrl?: string | undefined;
}>;
export declare const onboardingLocationSchema: z.ZodObject<{
    address: z.ZodString;
    lat: z.ZodNumber;
    lng: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    address: string;
    lat: number;
    lng: number;
}, {
    address: string;
    lat: number;
    lng: number;
}>;
//# sourceMappingURL=onboarding.validators.d.ts.map