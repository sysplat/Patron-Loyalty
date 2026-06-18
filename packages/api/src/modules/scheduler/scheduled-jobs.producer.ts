import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  SCHEDULED_JOB,
  SCHEDULED_JOB_CRON,
  SCHEDULED_JOBS_QUEUE,
} from './scheduled-jobs.constants';

/**
 * Registers the repeatable cron triggers on the {@link SCHEDULED_JOBS_QUEUE}.
 *
 * Uses BullMQ job schedulers (`upsertJobScheduler`), which are idempotent and
 * deduplicated in Redis by scheduler id. Every API replica runs this on boot,
 * but only one scheduler entry exists per job, so each schedule fires exactly
 * once cluster-wide — replacing the previous in-process `@Cron` + leader-lock
 * approach. Set `SCHEDULED_JOBS_ENABLED=false` to disable registration (e.g.
 * when scheduling is delegated to a dedicated worker deployment).
 */
@Injectable()
export class ScheduledJobsProducer implements OnModuleInit {
  private readonly logger = new Logger(ScheduledJobsProducer.name);

  constructor(@InjectQueue(SCHEDULED_JOBS_QUEUE) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    if (process.env.SCHEDULED_JOBS_ENABLED === 'false') {
      this.logger.log('Scheduled jobs disabled (SCHEDULED_JOBS_ENABLED=false)');
      return;
    }

    try {
      await Promise.all([
        this.register('appointment-reminders', SCHEDULED_JOB_CRON.appointmentReminders, {
          name: SCHEDULED_JOB.AppointmentRemindersDispatch,
        }),
        this.register('health-rollup', SCHEDULED_JOB_CRON.healthRollup, {
          name: SCHEDULED_JOB.HealthRollupDispatch,
        }),
        this.register('prior-session-cleanup', SCHEDULED_JOB_CRON.priorSessionCleanup, {
          name: SCHEDULED_JOB.PriorSessionCleanupDispatch,
        }),
        this.register('expire-stale-tickets', SCHEDULED_JOB_CRON.expireStaleTickets, {
          name: SCHEDULED_JOB.ExpireStaleTickets,
        }),
        this.register('anonymize-pii', SCHEDULED_JOB_CRON.anonymizePii, {
          name: SCHEDULED_JOB.AnonymizePii,
        }),
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
      this.logger.log('Scheduled job triggers registered');
    } catch (err) {
      this.logger.error(
        `Failed to register scheduled job triggers: ${err instanceof Error ? err.message : err}`,
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
