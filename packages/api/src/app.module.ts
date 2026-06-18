import { join } from 'path';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
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
import { appConfig } from './config/app.config';
import { JwtAuthGuard } from './common/guards/auth.guard';
import { RbacGuard } from './common/guards/rbac.guard';
import { CommonModule } from './common/common.module';
import { HealthController } from './common/health/health.controller';
import { StartupSeederService } from './common/startup/startup-seeder.service';

const resolveThrottleLimit = (envKey: string, fallback: number): number => {
  const raw = Number.parseInt(process.env[envKey] || '', 10);
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return raw;
};

@Module({
  imports: [
    // ─── Configuration ─────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      envFilePath: [
        '.env.local',
        '.env',
        '../../.env',
        // Fallback to absolute paths if relative resolution fails during watcher restarts
        join(process.cwd(), '.env.local'),
        join(process.cwd(), '.env'),
        join(process.cwd(), '../../.env'),
      ],
    }),

    CommonModule,
    EventEmitterModule.forRoot(),

    // ─── Rate Limiting ─────────────────────────
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 second
        limit: resolveThrottleLimit('THROTTLE_SHORT_LIMIT', 20),
      },
      {
        name: 'medium',
        ttl: 60000, // 1 minute
        limit: resolveThrottleLimit('THROTTLE_MEDIUM_LIMIT', 100),
      },
    ]),

    // ─── BullMQ (Background Jobs) ──────────────
    BullModule.forRoot({
      connection: process.env.REDIS_URL
        ? { url: process.env.REDIS_URL }
        : {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
            password: process.env.REDIS_PASSWORD,
          },
    }),

    // ─── Database & Cache ──────────────────────
    PrismaModule,
    RedisModule,

    // ─── Feature Modules ───────────────────────
    AuthModule,
    OnboardingModule,
    OrganizationModule,
    BranchModule,
    ServiceModule,
    QueueModule,
    TicketModule,
    UserModule,
    RoleModule,
    NotificationModule,
    DisplayModule,
    RealtimeModule,
    ReportModule,
    BillingModule,
    SettingsModule,
    DeskModule,
    AppointmentModule,
    AnnouncementModule,
    WebhookModule,
    UploadModule,
    SupportModule,
    PlatformAdminModule,
    ReviewModule,
    CustomerModule,
    LoyaltyModule,
    WorkflowModule,
    WorkbenchModule,
    ScheduledJobsModule,
  ],
  controllers: [HealthController],
  providers: [
    StartupSeederService,
    // ─── Global Guards (order matters: Throttler first, then JWT, then RBAC) ───
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RbacGuard },
  ],
})
export class AppModule {}
