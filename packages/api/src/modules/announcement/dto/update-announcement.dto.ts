import { createZodDto } from 'nestjs-zod';
import { updateAnnouncementSchema } from '@queueplatform/shared';

export class UpdateAnnouncementDto extends createZodDto(updateAnnouncementSchema) {}
