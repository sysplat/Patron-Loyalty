import { createZodDto } from 'nestjs-zod';
import {
  branchQueueSettingsSchema,
  createServiceCategorySchema,
  createServiceFieldsSchema,
  createSubServiceSchema,
  updateServiceSchema,
  updateSubServiceSchema,
} from '@queueplatform/shared';

export class CreateServiceDto extends createZodDto(createServiceFieldsSchema) {}
export class UpdateServiceDto extends createZodDto(updateServiceSchema) {}
export class CreateServiceCategoryDto extends createZodDto(createServiceCategorySchema) {}
export class BranchQueueSettingsDto extends createZodDto(branchQueueSettingsSchema) {}
export class CreateSubServiceDto extends createZodDto(createSubServiceSchema) {}
export class UpdateSubServiceDto extends createZodDto(updateSubServiceSchema) {}
