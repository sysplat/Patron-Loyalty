import { createZodDto } from 'nestjs-zod';
import { createDeskSchema } from '@queueplatform/shared';

export class CreateDeskDto extends createZodDto(createDeskSchema) {}
