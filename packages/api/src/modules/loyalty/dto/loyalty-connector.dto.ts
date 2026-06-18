import { createZodDto } from 'nestjs-zod';
import {
  loyaltyIntegrationQueueEventSchema,
  patronLoyaltyIntegrationConfigSchema,
} from '@queueplatform/shared';

export class LoyaltyIntegrationQueueEventDto extends createZodDto(
  loyaltyIntegrationQueueEventSchema,
) {}

export class PatronLoyaltyConnectorConfigDto extends createZodDto(
  patronLoyaltyIntegrationConfigSchema,
) {}
