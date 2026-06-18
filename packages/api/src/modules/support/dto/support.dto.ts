import { createZodDto } from 'nestjs-zod';
import {
  createSupportRequestSchema,
  reassignSupportContactSchema,
  supportMessageSchema,
  updateSupportRequestSchema,
} from '@queueplatform/shared';

export class CreateSupportRequestDto extends createZodDto(createSupportRequestSchema) {}
export class SupportMessageDto extends createZodDto(supportMessageSchema) {}
export class UpdateSupportRequestDto extends createZodDto(updateSupportRequestSchema) {}
export class ReassignSupportContactDto extends createZodDto(reassignSupportContactSchema) {}
