import { createZodDto } from 'nestjs-zod';
import { loyaltyAddonCheckoutSchema } from '@queueplatform/shared';

export class LoyaltyAddonCheckoutDto extends createZodDto(loyaltyAddonCheckoutSchema) {}
