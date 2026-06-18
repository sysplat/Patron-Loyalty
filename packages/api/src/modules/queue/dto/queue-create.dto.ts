import { createZodDto } from 'nestjs-zod';
import { createQueueSchema } from '@queueplatform/shared';

export class QueueCreateDto extends createZodDto(createQueueSchema) {}
