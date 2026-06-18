import { createZodDto } from 'nestjs-zod';
import { listTicketsQuerySchema } from '@queueplatform/shared';

export class ListTicketsQueryDto extends createZodDto(listTicketsQuerySchema) {}
