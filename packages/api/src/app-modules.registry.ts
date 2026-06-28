import type { Type } from '@nestjs/common';
import {
  API_DEPLOY_PROFILES,
  type ApiDeployProfile,
  resolveApiDeployProfile,
} from '@queueplatform/shared';
import { AuthModule } from './modules/auth/auth.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { BranchModule } from './modules/branch/branch.module';
import { ServiceModule } from './modules/service/service.module';
import { QueueModule } from './modules/queue/queue.module';
import { TicketModule } from './modules/ticket/ticket.module';
import { UserModule } from './modules/user/user.module';
import { RoleModule } from './modules/role/role.module';
import { NotificationModule } from './modules/notification/notification.module';
import { DisplayModule } from './modules/display/display.module';
import { ReportModule } from './modules/report/report.module';
import { BillingModule } from './modules/billing/billing.module';
import { SettingsModule } from './modules/settings/settings.module';
import { DeskModule } from './modules/desk/desk.module';
import { AppointmentModule } from './modules/appointment/appointment.module';
import { AnnouncementModule } from './modules/announcement/announcement.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { UploadModule } from './modules/upload/upload.module';
import { SupportModule } from './modules/support/support.module';
import { PlatformAdminModule } from './modules/platform-admin/platform-admin.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { ReviewModule } from './modules/review/review.module';
import { CustomerModule } from './modules/customer/customer.module';
import { LoyaltyModule } from './modules/loyalty/loyalty.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { WorkbenchModule } from './modules/workbench/workbench.module';
import { ScheduledJobsModule } from './modules/scheduler/scheduled-jobs.module';
import { ScheduledJobsLoyaltyModule } from './modules/scheduler/scheduled-jobs-loyalty.module';

/** Shared modules for both deploy profiles. */
export const API_SHARED_FEATURE_MODULES: Type[] = [
  AuthModule,
  OnboardingModule,
  OrganizationModule,
  UserModule,
  RoleModule,
  CustomerModule,
  LoyaltyModule,
  NotificationModule,
  WebhookModule,
  BillingModule,
  SettingsModule,
  UploadModule,
  SupportModule,
  PlatformAdminModule,
];

/** Queue-management modules — omitted when `API_DEPLOY_PROFILE=loyalty`. */
export const API_QUEUE_FEATURE_MODULES: Type[] = [
  BranchModule,
  ServiceModule,
  QueueModule,
  TicketModule,
  DisplayModule,
  RealtimeModule,
  ReportModule,
  DeskModule,
  AppointmentModule,
  AnnouncementModule,
  ReviewModule,
  WorkflowModule,
  WorkbenchModule,
];

export function resolveFeatureModulesForProfile(
  profile: ApiDeployProfile = resolveApiDeployProfile(),
): Type[] {
  if (profile === API_DEPLOY_PROFILES.LOYALTY) {
    return [...API_SHARED_FEATURE_MODULES, ScheduledJobsLoyaltyModule];
  }
  return [...API_SHARED_FEATURE_MODULES, ...API_QUEUE_FEATURE_MODULES, ScheduledJobsModule];
}
