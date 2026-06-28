import { Logger } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
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

@Processor(SCHEDULED_JOBS_QUEUE, { concurrency: resolveConcurrency() })
export class ScheduledJobsLoyaltyProcessor extends WorkerHost {
  private readonly logger = new Logger(ScheduledJobsLoyaltyProcessor.name);

  constructor(
    @InjectQueue(SCHEDULED_JOBS_QUEUE) private readonly queue: Queue,
    private readonly prisma: PrismaService,
    private readonly loyaltyExpiry: LoyaltyPointsExpiryService,
    private readonly loyaltyCampaignAutomation: LoyaltyCampaignAutomationService,
    private readonly loyaltyCampaigns: LoyaltyCampaignService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case SCHEDULED_JOB.LoyaltyPointsExpiryDispatch:
        return this.fanOutPerOrg(SCHEDULED_JOB.LoyaltyPointsExpiryOrg);
      case SCHEDULED_JOB.LoyaltyCampaignAutomationDispatch:
        return this.fanOutPerOrg(SCHEDULED_JOB.LoyaltyCampaignAutomationOrg);
      case SCHEDULED_JOB.LoyaltyScheduledCampaignsDispatch:
        return this.fanOutPerOrg(SCHEDULED_JOB.LoyaltyScheduledCampaignsOrg);

      case SCHEDULED_JOB.LoyaltyPointsExpiryOrg:
        return this.runLoyaltyPointsExpiry(job.data as OrgScopedJobData);
      case SCHEDULED_JOB.LoyaltyCampaignAutomationOrg:
        return this.runLoyaltyCampaignAutomation(job.data as OrgScopedJobData);
      case SCHEDULED_JOB.LoyaltyScheduledCampaignsOrg:
        return this.runLoyaltyScheduledCampaigns(job.data as OrgScopedJobData);

      default:
        this.logger.warn(`Unknown loyalty scheduled job: ${job.name}`);
    }
  }

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

  private async runLoyaltyPointsExpiry({ orgId }: OrgScopedJobData): Promise<void> {
    await this.loyaltyExpiry.expireForOrg(orgId);
  }

  private async runLoyaltyCampaignAutomation({ orgId }: OrgScopedJobData): Promise<void> {
    await this.loyaltyCampaignAutomation.processDailyTriggers(orgId);
  }

  private async runLoyaltyScheduledCampaigns({ orgId }: OrgScopedJobData): Promise<void> {
    await this.loyaltyCampaigns.processDueScheduled(orgId);
  }
}
