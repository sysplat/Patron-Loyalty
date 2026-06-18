import { createZodDto } from 'nestjs-zod';
import { bookAppointmentSchema } from '@queueplatform/shared';

export class BookAppointmentDto extends createZodDto(bookAppointmentSchema) {}
