import { createZodDto } from 'nestjs-zod';
import {
  billingPortalSchema,
  changePlanSchema,
  smsCreditCheckoutSchema,
  subscriptionCheckoutSchema,
} from '@queueplatform/shared';

export class ChangePlanDto extends createZodDto(changePlanSchema) {}
export class SmsCreditCheckoutDto extends createZodDto(smsCreditCheckoutSchema) {}
export class SubscriptionCheckoutDto extends createZodDto(subscriptionCheckoutSchema) {}
export class BillingPortalDto extends createZodDto(billingPortalSchema) {}
