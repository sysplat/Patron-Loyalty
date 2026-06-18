import { createZodDto } from 'nestjs-zod';
import {
  claimReversePairingSchema,
  createDisplayThemeSchema,
  linkDisplayScreenSchema,
  refreshDisplayTokenSchema,
  updateDisplayDeviceSchema,
  updateDisplayThemeSchema,
} from '@queueplatform/shared';

export class LinkDisplayScreenDto extends createZodDto(linkDisplayScreenSchema) {}
export class ClaimReversePairingDto extends createZodDto(claimReversePairingSchema) {}
export class UpdateDisplayDeviceDto extends createZodDto(updateDisplayDeviceSchema) {}
export class RefreshDisplayTokenDto extends createZodDto(refreshDisplayTokenSchema) {}
export class CreateDisplayThemeDto extends createZodDto(createDisplayThemeSchema) {}
export class UpdateDisplayThemeDto extends createZodDto(updateDisplayThemeSchema) {}
