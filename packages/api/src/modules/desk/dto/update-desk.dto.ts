import { createZodDto } from 'nestjs-zod';
import { updateDeskSchema } from '@queueplatform/shared';

export class UpdateDeskDto extends createZodDto(updateDeskSchema) {}
