import { createZodDto } from 'nestjs-zod';
import { createWebhookSchema, updateWebhookSchema } from '@queueplatform/shared';

export class CreateWebhookDto extends createZodDto(createWebhookSchema) {}
export class UpdateWebhookDto extends createZodDto(updateWebhookSchema) {}
