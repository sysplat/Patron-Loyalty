"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onboardingLocationSchema = exports.onboardingCompanyProfileSchema = exports.onboardingModulesSchema = void 0;
const zod_1 = require("zod");
const organization_validators_1 = require("./organization.validators");
exports.onboardingModulesSchema = zod_1.z.object({
    modules: zod_1.z.array(zod_1.z.string().min(1)).min(1),
});
exports.onboardingCompanyProfileSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(200).trim(),
    website: zod_1.z.string().url().max(500).optional().or(zod_1.z.literal('')),
    industry: zod_1.z.string().min(1).max(100),
    timezone: zod_1.z.string().min(1),
    country: zod_1.z.string().min(1).max(100),
    logoUrl: organization_validators_1.organizationLogoUrlSchema,
});
exports.onboardingLocationSchema = zod_1.z.object({
    address: zod_1.z.string().min(1).max(500),
    lat: zod_1.z.number().min(-90).max(90),
    lng: zod_1.z.number().min(-180).max(180),
});
//# sourceMappingURL=onboarding.validators.js.map