import { z } from 'zod';

export const createRoleSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).optional(),
  permissionIds: z.array(z.string().uuid()).min(1),
});

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).optional(),
});

export const updateRolePermissionsSchema = z.object({
  permissionIds: z.array(z.string().uuid()),
});

export const assignRoleSchema = z.object({
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
});
