import { createZodDto } from 'nestjs-zod';
import {
  createFlowTemplateSchema,
  stopQueueSchema,
  updateFlowTemplateSchema,
} from '@queueplatform/shared';

export class CreateFlowTemplateDto extends createZodDto(createFlowTemplateSchema) {}
export class UpdateFlowTemplateDto extends createZodDto(updateFlowTemplateSchema) {}
export class StopQueueDto extends createZodDto(stopQueueSchema) {}
