import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AppointmentModule } from '../appointment/appointment.module';
import { TicketModule } from '../ticket/ticket.module';
import { PlatformAdminModule } from '../platform-admin/platform-admin.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { SCHEDULED_JOBS_QUEUE } from './scheduled-jobs.constants';
import { ScheduledJobsProducer } from './scheduled-jobs.producer';
import { ScheduledJobsProcessor } from './scheduled-jobs.processor';

/**
 * Platform-wide scheduled (cron) work, backed by a BullMQ queue.
 *
 * Replaces the in-process `@Cron` schedulers: a repeatable dispatcher fires once
 * per schedule cluster-wide and fans work out into tenant-scoped jobs that any
 * API replica's worker can process in parallel.
 */
@Module({
  imports: [
    BullModule.registerQueue({ name: SCHEDULED_JOBS_QUEUE }),
    AppointmentModule,
    TicketModule,
    PlatformAdminModule,
    LoyaltyModule,
  ],
  providers: [
    ScheduledJobsProducer,
    ...(process.env.SCHEDULED_JOBS_WORKER_ENABLED !== 'false' ? [ScheduledJobsProcessor] : []),
  ],
})
export class ScheduledJobsModule {}
