import { createZodDto } from 'nestjs-zod';
import {
  assignRoleSchema,
  createRoleSchema,
  updateRolePermissionsSchema,
  updateRoleSchema,
} from '@queueplatform/shared';

export class CreateRoleDto extends createZodDto(createRoleSchema) {}
export class UpdateRoleDto extends createZodDto(updateRoleSchema) {}
export class UpdateRolePermissionsDto extends createZodDto(updateRolePermissionsSchema) {}
export class AssignRoleDto extends createZodDto(assignRoleSchema) {}
