import { z } from 'zod';
import { passwordSchema } from './auth.validators';

export const inviteUserSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  roleId: z.string().uuid(),
  password: passwordSchema,
  branchIds: z.array(z.string().uuid()).optional(),
});

export const setUserPasswordSchema = z.object({
  password: passwordSchema,
});

export const updateUserSchema = z
  .object({
    firstName: z.string().min(1).max(100).trim().optional(),
    lastName: z.string().min(1).max(100).trim().optional(),
    phone: z.string().max(30).trim().optional(),
    description: z.string().max(500).trim().optional(),
    language: z.string().max(10).trim().optional(),
    timezone: z.string().max(64).trim().optional(),
    avatarUrl: z.string().max(2000).trim().optional(),
    roleId: z.string().uuid().optional(),
    branchIds: z.array(z.string().uuid()).optional(),
  })
  .strict();
