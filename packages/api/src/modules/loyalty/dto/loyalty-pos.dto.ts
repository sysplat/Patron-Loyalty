import { createZodDto } from 'nestjs-zod';
import {
  loyaltySquareConnectionSchema,
  loyaltyCloverConnectionSchema,
} from '@queueplatform/shared';

export class LoyaltySquareConnectionDto extends createZodDto(loyaltySquareConnectionSchema) {}
export class LoyaltyCloverConnectionDto extends createZodDto(loyaltyCloverConnectionSchema) {}
