import { createZodDto } from 'nestjs-zod';
import { listAppointmentsQuerySchema } from '@queueplatform/shared';

export class ListAppointmentsQueryDto extends createZodDto(listAppointmentsQuerySchema) {}
