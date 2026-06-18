import { createZodDto } from 'nestjs-zod';
import { centrifugoWebhookSchema } from '@queueplatform/shared';

export class CentrifugoWebhookDto extends createZodDto(centrifugoWebhookSchema) {}
