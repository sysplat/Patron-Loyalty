import { createZodDto } from 'nestjs-zod';
import { loyaltyPublicReferralJoinSchema } from '@queueplatform/shared';

export class LoyaltyPublicReferralJoinDto extends createZodDto(loyaltyPublicReferralJoinSchema) {}
