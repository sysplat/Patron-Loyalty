import { createZodDto } from 'nestjs-zod';
import { updateOrganizationSchema } from '@queueplatform/shared';

export class UpdateOrganizationDto extends createZodDto(updateOrganizationSchema) {}
