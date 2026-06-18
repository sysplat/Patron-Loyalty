import { z } from 'zod';
import { organizationLogoUrlSchema } from './organization.validators';

export const onboardingModulesSchema = z.object({
  modules: z.array(z.string().min(1)).min(1),
});

export const onboardingCompanyProfileSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  website: z.string().url().max(500).optional().or(z.literal('')),
  industry: z.string().min(1).max(100),
  timezone: z.string().min(1),
  country: z.string().min(1).max(100),
  logoUrl: organizationLogoUrlSchema,
});

export const onboardingLocationSchema = z.object({
  address: z.string().min(1).max(500),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
