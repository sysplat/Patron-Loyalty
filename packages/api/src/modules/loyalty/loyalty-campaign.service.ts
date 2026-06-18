import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PatronCrmFeatureService } from '../../common/features/patron-crm-feature.service';
import { CustomerSegmentService } from '../customer/customer-segment.service';
import { LoyaltyCampaignDispatchService } from './loyalty-campaign-dispatch.service';
import type { CustomerSegmentPreset } from '@queueplatform/shared';

@Injectable()
export class LoyaltyCampaignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patronCrmFeature: PatronCrmFeatureService,
    private readonly segments: CustomerSegmentService,
    private readonly dispatch: LoyaltyCampaignDispatchService,
  ) {}

  async list(orgId: string) {
    await this.patronCrmFeature.requireEnabled(orgId);
    return this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyCampaign.findMany({ orderBy: { createdAt: 'desc' } }),
    );
  }

  async create(orgId: string, data: Record<string, unknown>) {
    await this.patronCrmFeature.requireEnabled(orgId);
    const scheduledAt = data.scheduledAt ? new Date(String(data.scheduledAt)) : null;
    const status =
      scheduledAt && scheduledAt.getTime() > Date.now() ? 'scheduled' : (data.status ?? 'draft');
    return this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyCampaign.create({
        data: { orgId, ...data, status, scheduledAt } as never,
      }),
    );
  }

  async update(orgId: string, id: string, data: object) {
    await this.patronCrmFeature.requireEnabled(orgId);
    return this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyCampaign.update({ where: { id }, data }),
    );
  }

  async launch(orgId: string, campaignId: string) {
    await this.patronCrmFeature.requireEnabled(orgId);
    const campaign = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyCampaign.findFirst({ where: { id: campaignId, orgId } }),
    );
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.status === 'completed') {
      throw new BadRequestException('Campaign already completed');
    }

    let customerIds: string[] | null = null;
    if (campaign.segmentPreset) {
      customerIds = await this.segments.resolvePresetCustomerIds(
        orgId,
        campaign.segmentPreset as CustomerSegmentPreset,
      );
    }

    const accounts = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyAccount.findMany({
        where: customerIds
          ? {
              orgId,
              customerId: {
                in: customerIds.length > 0 ? customerIds : ['00000000-0000-0000-0000-000000000000'],
              },
            }
          : { orgId },
        select: { id: true },
        take: 500,
      }),
    );

    await this.prisma.withTenant(orgId, async (tx) => {
      if (accounts.length > 0) {
        await tx.loyaltyCampaignSend.createMany({
          data: accounts.map((a) => ({
            orgId,
            campaignId,
            accountId: a.id,
            status: 'queued',
          })),
        });
      }
      await tx.loyaltyCampaign.update({
        where: { id: campaignId },
        data: { status: 'active', sentCount: 0 },
      });
    });

    const delivery = await this.dispatch.dispatchCampaign(orgId, campaignId);

    await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyCampaign.update({
        where: { id: campaignId },
        data: { sentCount: delivery.sent },
      }),
    );

    return { queued: accounts.length, campaignId, ...delivery };
  }

  async processDueScheduled(orgId: string): Promise<number> {
    await this.patronCrmFeature.requireEnabled(orgId);
    const now = new Date();
    const due = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyCampaign.findMany({
        where: { orgId, status: 'scheduled', scheduledAt: { lte: now } },
        select: { id: true },
        take: 20,
      }),
    );
    let launched = 0;
    for (const campaign of due) {
      await this.launch(orgId, campaign.id);
      launched += 1;
    }
    return launched;
  }
}
