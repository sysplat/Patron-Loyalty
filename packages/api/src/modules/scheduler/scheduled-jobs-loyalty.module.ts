import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { SCHEDULED_JOBS_QUEUE } from './scheduled-jobs.constants';
import { ScheduledJobsLoyaltyProducer } from './scheduled-jobs-loyalty.producer';
import { ScheduledJobsLoyaltyProcessor } from './scheduled-jobs-loyalty.processor';

/**
 * Scheduled jobs for Patron Loyalty deploy profile (`API_DEPLOY_PROFILE=loyalty`).
 * Registers loyalty points expiry and campaign automation only — no QMS ticket/appointment crons.
 */
@Module({
  imports: [BullModule.registerQueue({ name: SCHEDULED_JOBS_QUEUE }), LoyaltyModule],
  providers: [
    ScheduledJobsLoyaltyProducer,
    ...(process.env.SCHEDULED_JOBS_WORKER_ENABLED !== 'false'
      ? [ScheduledJobsLoyaltyProcessor]
      : []),
  ],
})
export class ScheduledJobsLoyaltyModule {}
