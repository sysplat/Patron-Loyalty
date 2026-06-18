import { createZodDto } from 'nestjs-zod';
import { createAnnouncementSchema } from '@queueplatform/shared';

export class CreateAnnouncementDto extends createZodDto(createAnnouncementSchema) {}
