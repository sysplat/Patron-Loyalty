import { Injectable } from '@nestjs/common';
import { PlanLimitService } from '../billing/plan-limit.service';
import { SmsUsageService } from '../billing/sms-usage.service';

export type SmsDeliveryUsageSnapshot = {
  effectiveLimit: number;
  used: number;
  atNinetyPercentThreshold: boolean;
};

/**
 * Application contract for SMS plan gates and usage accounting.
 * Keeps billing coupling out of notification dispatch/orchestration code paths.
 */
@Injectable()
export class NotificationSmsEntitlementService {
  constructor(
    private readonly planLimits: PlanLimitService,
    private readonly smsUsage: SmsUsageService,
  ) {}

  async assertCanSendSms(orgId: string, options?: { skipPlanGate?: boolean }): Promise<void> {
    if (options?.skipPlanGate) {
      return;
    }
    await this.planLimits.requireFeature(
      orgId,
      'hasSmsNotifications',
      'SMS notifications require a Professional or Enterprise plan. Please upgrade to send SMS.',
    );
    const allowance = await this.planLimits.getSmsCreditsAllowance(orgId);
    await this.smsUsage.assertSmsCreditsAvailable(orgId, allowance.effectiveLimit);
  }

  async snapshotUsageAfterDelivery(orgId: string): Promise<SmsDeliveryUsageSnapshot> {
    await this.smsUsage.syncUsageCacheFromDb(orgId);
    const allowance = await this.planLimits.getSmsCreditsAllowance(orgId);
    const used = await this.smsUsage.getUsedCount(orgId);
    const threshold = Math.floor(allowance.effectiveLimit * 0.9);
    return {
      effectiveLimit: allowance.effectiveLimit,
      used,
      atNinetyPercentThreshold: threshold > 0 && used === threshold,
    };
  }

  async syncUsageAfterFailedDelivery(orgId: string): Promise<void> {
    await this.smsUsage.syncUsageCacheFromDb(orgId);
  }
}
