import { createZodDto } from 'nestjs-zod';
import {
  createBranchSchema,
  setWorkingHoursSchema,
  updateBranchCustomerNoticeSchema,
  updateBranchSchema,
  upsertDateOverrideSchema,
} from '@queueplatform/shared';

export class CreateBranchDto extends createZodDto(createBranchSchema) {}
export class UpdateBranchDto extends createZodDto(updateBranchSchema) {}
export class UpdateBranchCustomerNoticeDto extends createZodDto(updateBranchCustomerNoticeSchema) {}
export class SetWorkingHoursDto extends createZodDto(setWorkingHoursSchema) {}
export class UpsertDateOverrideDto extends createZodDto(upsertDateOverrideSchema) {}
