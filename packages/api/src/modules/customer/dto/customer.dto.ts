import { createZodDto } from 'nestjs-zod';
import {
  createCustomerSchema,
  createCustomerSegmentSchema,
  updateCustomerSchema,
} from '@queueplatform/shared';

export class UpdateCustomerDto extends createZodDto(updateCustomerSchema) {}
export class CreateCustomerDto extends createZodDto(createCustomerSchema) {}
export class CreateCustomerSegmentDto extends createZodDto(createCustomerSegmentSchema) {}
