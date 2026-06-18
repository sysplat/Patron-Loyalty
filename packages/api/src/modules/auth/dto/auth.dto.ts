import { createZodDto } from 'nestjs-zod';
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  twoFactorLoginSchema,
  enableTwoFactorSchema,
  disableTwoFactorSchema,
  regenerateBackupCodesSchema,
} from '@queueplatform/shared';

export class RegisterDto extends createZodDto(registerSchema) {}
export class LoginDto extends createZodDto(loginSchema) {}
export class VerifyEmailDto extends createZodDto(verifyEmailSchema) {}
export class ForgotPasswordDto extends createZodDto(forgotPasswordSchema) {}
export class ResetPasswordDto extends createZodDto(resetPasswordSchema) {}
export class RefreshTokenDto extends createZodDto(refreshTokenSchema) {}
export class TwoFactorLoginDto extends createZodDto(twoFactorLoginSchema) {}
export class EnableTwoFactorDto extends createZodDto(enableTwoFactorSchema) {}
export class DisableTwoFactorDto extends createZodDto(disableTwoFactorSchema) {}
export class RegenerateBackupCodesDto extends createZodDto(regenerateBackupCodesSchema) {}
