import { createZodDto } from 'nestjs-zod';
import {
  createIntegrationSchema,
  createSettingsWebhookSchema,
  setBulkSettingsSchema,
  setSettingSchema,
  updateIntegrationSchema,
} from '@queueplatform/shared';

export class SetSettingDto extends createZodDto(setSettingSchema) {}
export class SetBulkSettingsDto extends createZodDto(setBulkSettingsSchema) {}
export class CreateIntegrationDto extends createZodDto(createIntegrationSchema) {}
export class UpdateIntegrationDto extends createZodDto(updateIntegrationSchema) {}
export class CreateSettingsWebhookDto extends createZodDto(createSettingsWebhookSchema) {}
