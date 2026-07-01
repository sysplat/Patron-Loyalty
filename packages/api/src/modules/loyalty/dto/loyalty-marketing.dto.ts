import { createZodDto } from 'nestjs-zod';
import {
  loyaltyKlaviyoConnectionSchema,
  loyaltyMailchimpConnectionSchema,
} from '@queueplatform/shared';

export class LoyaltyKlaviyoConnectionDto extends createZodDto(loyaltyKlaviyoConnectionSchema) {}
export class LoyaltyMailchimpConnectionDto extends createZodDto(loyaltyMailchimpConnectionSchema) {}
