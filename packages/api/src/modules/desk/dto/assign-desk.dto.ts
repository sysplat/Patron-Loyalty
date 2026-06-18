import { createZodDto } from 'nestjs-zod';
import { assignDeskSchema } from '@queueplatform/shared';

export class AssignDeskDto extends createZodDto(assignDeskSchema) {}
