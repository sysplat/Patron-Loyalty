import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { AppointmentService } from '../appointment/appointment.service';
import { TicketService } from '../ticket/ticket.service';
import { PlatformHealthService } from '../platform-admin/platform-health.service';
import { LoyaltyPointsExpiryService } from '../loyalty/loyalty-points-expiry.service';
import { LoyaltyCampaignAutomationService } from '../loyalty/loyalty-campaign-automation.service';
import { LoyaltyCampaignService } from '../loyalty/loyalty-campaign.service';
import {
  SCHEDULED_JOB,
  SCHEDULED_JOBS_QUEUE,
  type OrgScopedJobData,
} from './scheduled-jobs.constants';

const resolveConcurrency = (): number => {
  const raw = Number.parseInt(process.env.SCHEDULED_JOBS_CONCURRENCY ?? '', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 5;
};

/**
 * Worker for the {@link SCHEDULED_JOBS_QUEUE}.
 *
 * Runs in every API replica, so the per-tenant (`*.org`) jobs produced by the
 * dispatchers are distributed across all replicas and processed concurrently
 * (`SCHEDULED_JOBS_CONCURRENCY`, default 5). Dispatch jobs fan out one job per
 * active org; global jobs run as a single unit.
 */
@Processor(SCHEDULED_JOBS_QUEUE, { concurrency: resolveConcurrency() })
export class ScheduledJobsProcessor extends WorkerHost {
  private readonly logger = new Logger(ScheduledJobsProcessor.name);

  constructor(
    @InjectQueue(SCHEDULED_JOBS_QUEUE) private readonly queue: Queue,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly appointments: AppointmentService,
    private readonly tickets: TicketService,
    private readonly health: PlatformHealthService,
    private readonly loyaltyExpiry: LoyaltyPointsExpiryService,
    private readonly loyaltyCampaignAutomation: LoyaltyCampaignAutomationService,
    private readonly loyaltyCampaigns: LoyaltyCampaignService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case SCHEDULED_JOB.AppointmentRemindersDispatch:
        return this.fanOutPerOrg(SCHEDULED_JOB.AppointmentRemindersOrg);
      case SCHEDULED_JOB.HealthRollupDispatch:
        return this.fanOutPerOrg(SCHEDULED_JOB.HealthRollupOrg);
      case SCHEDULED_JOB.PriorSessionCleanupDispatch:
        if (!this.config.get<boolean>('app.queue.closePriorSessionWaiting', true)) return;
        return this.fanOutPerOrg(SCHEDULED_JOB.PriorSessionCleanupOrg);
      case SCHEDULED_JOB.LoyaltyPointsExpiryDispatch:
        return this.fanOutPerOrg(SCHEDULED_JOB.LoyaltyPointsExpiryOrg);
      case SCHEDULED_JOB.LoyaltyCampaignAutomationDispatch:
        return this.fanOutPerOrg(SCHEDULED_JOB.LoyaltyCampaignAutomationOrg);
      case SCHEDULED_JOB.LoyaltyScheduledCampaignsDispatch:
        return this.fanOutPerOrg(SCHEDULED_JOB.LoyaltyScheduledCampaignsOrg);

      case SCHEDULED_JOB.AppointmentRemindersOrg:
        return this.runAppointmentReminders(job.data as OrgScopedJobData);
      case SCHEDULED_JOB.HealthRollupOrg:
        return this.runHealthRollup(job.data as OrgScopedJobData);
      case SCHEDULED_JOB.PriorSessionCleanupOrg:
        return this.runPriorSessionCleanup(job.data as OrgScopedJobData);
      case SCHEDULED_JOB.LoyaltyPointsExpiryOrg:
        return this.runLoyaltyPointsExpiry(job.data as OrgScopedJobData);
      case SCHEDULED_JOB.LoyaltyCampaignAutomationOrg:
        return this.runLoyaltyCampaignAutomation(job.data as OrgScopedJobData);
      case SCHEDULED_JOB.LoyaltyScheduledCampaignsOrg:
        return this.runLoyaltyScheduledCampaigns(job.data as OrgScopedJobData);

      case SCHEDULED_JOB.ExpireStaleTickets:
        return this.runExpireStaleTickets();
      case SCHEDULED_JOB.AnonymizePii:
        return this.runAnonymizePii();

      default:
        this.logger.warn(`Unknown scheduled job: ${job.name}`);
    }
  }

  /** Enqueue one tenant-scoped job per active org for the given job name. */
  private async fanOutPerOrg(orgJobName: string): Promise<void> {
    const orgs = await this.prisma.organization.findMany({
      where: { status: { not: 'suspended' } },
      select: { id: true },
    });
    if (orgs.length === 0) return;

    await this.queue.addBulk(
      orgs.map((org) => ({
        name: orgJobName,
        data: { orgId: org.id } satisfies OrgScopedJobData,
        opts: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 200,
          removeOnFail: 500,
        },
      })),
    );
    this.logger.log(`Dispatched ${orgs.length} ${orgJobName} job(s)`);
  }

  private async runAppointmentReminders({ orgId }: OrgScopedJobData): Promise<void> {
    const sent = await this.appointments.sendDueReminders(orgId);
    if (sent > 0) this.logger.log(`Queued ${sent} appointment reminder(s) for org ${orgId}`);
  }

  private async runHealthRollup({ orgId }: OrgScopedJobData): Promise<void> {
    await this.health.computeSnapshotForOrg(orgId);
  }

  private async runPriorSessionCleanup({ orgId }: OrgScopedJobData): Promise<void> {
    const result = await this.tickets.closePriorSessionWaitingTickets({ orgId });
    if (result.closed > 0) {
      this.logger.warn(
        `Marked ${result.closed} prior-session waiting ticket(s) as no-show for org ${orgId}`,
      );
    }
  }

  private async runLoyaltyPointsExpiry({ orgId }: OrgScopedJobData): Promise<void> {
    await this.loyaltyExpiry.expireForOrg(orgId);
  }

  private async runLoyaltyCampaignAutomation({ orgId }: OrgScopedJobData): Promise<void> {
    await this.loyaltyCampaignAutomation.processDailyTriggers(orgId);
  }

  private async runLoyaltyScheduledCampaigns({ orgId }: OrgScopedJobData): Promise<void> {
    await this.loyaltyCampaigns.processDueScheduled(orgId);
  }

  private async runExpireStaleTickets(): Promise<void> {
    const thresholdMinutes = this.config.get<number>('STALE_TICKET_THRESHOLD_MINUTES', 120);
    const count = await this.tickets.expireStaleTickets(thresholdMinutes);
    if (count > 0) this.logger.warn(`Expired ${count} stale ticket(s)`);
  }

  private async runAnonymizePii(): Promise<void> {
    const retentionDays = this.config.get<number>('app.privacy.ticketPiiRetentionDays', 30);
    const dryRun = this.config.get<boolean>('app.privacy.ticketPiiAnonymizeDryRun', false);
    const result = await this.tickets.anonymizeHistoricalPii(retentionDays, dryRun);
    this.logger.log(
      `Ticket PII anonymization completed (affected=${result.affected}, dryRun=${result.dryRun})`,
    );
  }
}
