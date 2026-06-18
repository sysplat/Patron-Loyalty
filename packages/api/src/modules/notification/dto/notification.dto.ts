import { createZodDto } from 'nestjs-zod';
import {
  createNotificationTemplateSchema,
  sendNotificationSchema,
  testSmsSchema,
  updateNotificationTemplateSchema,
} from '@queueplatform/shared';

export class CreateNotificationTemplateDto extends createZodDto(createNotificationTemplateSchema) {}
export class UpdateNotificationTemplateDto extends createZodDto(updateNotificationTemplateSchema) {}
export class SendNotificationDto extends createZodDto(sendNotificationSchema) {}
export class TestSmsDto extends createZodDto(testSmsSchema) {}
