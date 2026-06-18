import { createZodDto } from 'nestjs-zod';
import {
  bulkTenantSuspendSchema,
  createPlatformAdminSchema,
  platformAnnouncementSchema,
  platformDataPurgeDryRunSchema,
  platformDataPurgeSchema,
  platformImpersonationSchema,
  tenantPlanSlugSchema,
  tenantSuspendSchema,
  tenantVisitJourneysSchema,
  tenantAppointmentsSchema,
  tenantPatronCrmSchema,
  updatePlatformAnnouncementSchema,
  updateTenantProfileSchema,
} from '@queueplatform/shared';

export class BulkTenantSuspendDto extends createZodDto(bulkTenantSuspendSchema) {}
export class TenantSuspendDto extends createZodDto(tenantSuspendSchema) {}
export class TenantVisitJourneysDto extends createZodDto(tenantVisitJourneysSchema) {}
export class TenantAppointmentsDto extends createZodDto(tenantAppointmentsSchema) {}
export class TenantPatronCrmDto extends createZodDto(tenantPatronCrmSchema) {}
export class TenantPlanSlugDto extends createZodDto(tenantPlanSlugSchema) {}
export class CreatePlatformAdminDto extends createZodDto(createPlatformAdminSchema) {}
export class PlatformImpersonationDto extends createZodDto(platformImpersonationSchema) {}
export class PlatformDataPurgeDryRunDto extends createZodDto(platformDataPurgeDryRunSchema) {}
export class PlatformDataPurgeDto extends createZodDto(platformDataPurgeSchema) {}
export class PlatformAnnouncementDto extends createZodDto(platformAnnouncementSchema) {}
export class UpdatePlatformAnnouncementDto extends createZodDto(updatePlatformAnnouncementSchema) {}
export class UpdateTenantProfileDto extends createZodDto(updateTenantProfileSchema) {}
