import { createZodDto } from 'nestjs-zod';
import { updateAppointmentSchema } from '@queueplatform/shared';

export class UpdateAppointmentDto extends createZodDto(updateAppointmentSchema) {}
