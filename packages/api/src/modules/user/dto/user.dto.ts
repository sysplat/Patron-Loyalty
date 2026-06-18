import { createZodDto } from 'nestjs-zod';
import { inviteUserSchema, setUserPasswordSchema, updateUserSchema } from '@queueplatform/shared';

export class InviteUserDto extends createZodDto(inviteUserSchema) {}
export class SetUserPasswordDto extends createZodDto(setUserPasswordSchema) {}
export class UpdateUserDto extends createZodDto(updateUserSchema) {}
