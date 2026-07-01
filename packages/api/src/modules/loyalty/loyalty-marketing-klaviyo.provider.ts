import { Injectable, Logger } from '@nestjs/common';
import { KLAVIYO_LOYALTY_PROPERTIES } from '@queueplatform/shared';

export type KlaviyoProfilePayload = {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  loyaltyPoints: number;
  loyaltyTier: string;
  loyaltyLifetimeValueCents: number;
  loyaltyTotalVisits: number;
  loyaltyReferralUrl: string | null;
};

/** Klaviyo API revision we target */
const KLAVIYO_API_REVISION = '2024-02-15';

@Injectable()
export class LoyaltyMarketingKlaviyoProvider {
  private readonly logger = new Logger(LoyaltyMarketingKlaviyoProvider.name);

  /**
   * Upsert a Klaviyo profile with loyalty custom properties.
   * Uses PATCH /api/profiles/ which creates-or-updates by email.
   * https://developers.klaviyo.com/en/reference/create_or_update_profile
   */
  async upsertProfile(apiKey: string, payload: KlaviyoProfilePayload): Promise<void> {
    const attributes: Record<string, unknown> = {
      properties: {
        [KLAVIYO_LOYALTY_PROPERTIES.POINTS]: payload.loyaltyPoints,
        [KLAVIYO_LOYALTY_PROPERTIES.TIER]: payload.loyaltyTier,
        [KLAVIYO_LOYALTY_PROPERTIES.LIFETIME_VALUE_CENTS]: payload.loyaltyLifetimeValueCents,
        [KLAVIYO_LOYALTY_PROPERTIES.TOTAL_VISITS]: payload.loyaltyTotalVisits,
        ...(payload.loyaltyReferralUrl
          ? { [KLAVIYO_LOYALTY_PROPERTIES.REFERRAL_URL]: payload.loyaltyReferralUrl }
          : {}),
      },
    };

    if (payload.email) attributes.email = payload.email;
    if (payload.phone) attributes.phone_number = payload.phone;
    if (payload.firstName) attributes.first_name = payload.firstName;
    if (payload.lastName) attributes.last_name = payload.lastName;

    const body = {
      data: {
        type: 'profile',
        attributes,
      },
    };

    const res = await fetch('https://a.klaviyo.com/api/profiles/', {
      method: 'POST',
      headers: {
        Authorization: `Klaviyo-API-Key ${apiKey}`,
        revision: KLAVIYO_API_REVISION,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });

    // 200 = updated, 201 = created, 409 = duplicate (handled by Klaviyo internally)
    if (!res.ok && res.status !== 409) {
      const text = await res.text().catch(() => '');
      this.logger.warn(
        `Klaviyo profile upsert failed status=${res.status} body=${text.slice(0, 200)}`,
      );
      throw new Error(`Klaviyo API error ${res.status}`);
    }
  }
}
