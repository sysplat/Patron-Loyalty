import { createZodDto } from 'nestjs-zod';
import {
  onboardingCompanyProfileSchema,
  onboardingLocationSchema,
  onboardingModulesSchema,
} from '@queueplatform/shared';

export class OnboardingModulesDto extends createZodDto(onboardingModulesSchema) {}
export class OnboardingCompanyProfileDto extends createZodDto(onboardingCompanyProfileSchema) {}
export class OnboardingLocationDto extends createZodDto(onboardingLocationSchema) {}
