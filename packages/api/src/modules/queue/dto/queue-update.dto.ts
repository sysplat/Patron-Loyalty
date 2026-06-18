import { createZodDto } from 'nestjs-zod';
import { updateQueueSchema } from '@queueplatform/shared';

export class QueueUpdateDto extends createZodDto(updateQueueSchema) {}
