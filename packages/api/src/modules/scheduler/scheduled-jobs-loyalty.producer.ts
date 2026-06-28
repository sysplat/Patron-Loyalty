import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  SCHEDULED_JOB,
  SCHEDULED_JOB_CRON,
  SCHEDULED_JOBS_QUEUE,
} from './scheduled-jobs.constants';

/** Loyalty-only cron triggers (Patron Loyalty deploy profile). */
@Injectable()
export class ScheduledJobsLoyaltyProducer implements OnModuleInit {
  private readonly logger = new Logger(ScheduledJobsLoyaltyProducer.name);

  constructor(@InjectQueue(SCHEDULED_JOBS_QUEUE) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    if (process.env.SCHEDULED_JOBS_ENABLED === 'false') {
      this.logger.log('Scheduled jobs disabled (SCHEDULED_JOBS_ENABLED=false)');
      return;
    }

    try {
      await Promise.all([
        this.register('loyalty-points-expiry', SCHEDULED_JOB_CRON.loyaltyPointsExpiry, {
          name: SCHEDULED_JOB.LoyaltyPointsExpiryDispatch,
        }),
        this.register('loyalty-campaign-automation', SCHEDULED_JOB_CRON.loyaltyCampaignAutomation, {
          name: SCHEDULED_JOB.LoyaltyCampaignAutomationDispatch,
        }),
        this.register('loyalty-scheduled-campaigns', SCHEDULED_JOB_CRON.loyaltyScheduledCampaigns, {
          name: SCHEDULED_JOB.LoyaltyScheduledCampaignsDispatch,
        }),
      ]);
      this.logger.log('Loyalty scheduled job triggers registered');
    } catch (err) {
      this.logger.error(
        `Failed to register loyalty scheduled job triggers: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private register(
    schedulerId: string,
    pattern: string,
    template: { name: string },
  ): Promise<unknown> {
    return this.queue.upsertJobScheduler(
      schedulerId,
      { pattern },
      {
        name: template.name,
        data: {},
        opts: { removeOnComplete: 50, removeOnFail: 100 },
      },
    );
  }
}
