import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { MAILCHIMP_LOYALTY_MERGE_FIELDS } from '@queueplatform/shared';

export type MailchimpMemberPayload = {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  loyaltyPoints: number;
  loyaltyTier: string;
  loyaltyTotalVisits: number;
  loyaltyReferralUrl: string | null;
};

@Injectable()
export class LoyaltyMarketingMailchimpProvider {
  private readonly logger = new Logger(LoyaltyMarketingMailchimpProvider.name);

  /**
   * Upsert a Mailchimp list member with loyalty merge fields.
   * Uses PUT /lists/{listId}/members/{subscriberHash} which is an upsert.
   * https://mailchimp.com/developer/marketing/api/list-members/add-or-update-list-member/
   */
  async upsertMember(
    apiKey: string,
    listId: string,
    serverPrefix: string,
    payload: MailchimpMemberPayload,
  ): Promise<void> {
    const subscriberHash = createHash('md5').update(payload.email.toLowerCase()).digest('hex');
    const apiBase = `https://${serverPrefix}.api.mailchimp.com/3.0`;

    const body = {
      email_address: payload.email,
      status_if_new: 'subscribed',
      merge_fields: {
        FNAME: payload.firstName ?? '',
        LNAME: payload.lastName ?? '',
        [MAILCHIMP_LOYALTY_MERGE_FIELDS.POINTS]: String(payload.loyaltyPoints),
        [MAILCHIMP_LOYALTY_MERGE_FIELDS.TIER]: payload.loyaltyTier,
        [MAILCHIMP_LOYALTY_MERGE_FIELDS.TOTAL_VISITS]: String(payload.loyaltyTotalVisits),
        [MAILCHIMP_LOYALTY_MERGE_FIELDS.REFERRAL_URL]: payload.loyaltyReferralUrl ?? '',
      },
    };

    const res = await fetch(`${apiBase}/lists/${listId}/members/${subscriberHash}`, {
      method: 'PUT',
      headers: {
        Authorization: `Basic ${Buffer.from(`anystring:${apiKey}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn(
        `Mailchimp member upsert failed status=${res.status} body=${text.slice(0, 200)}`,
      );
      throw new Error(`Mailchimp API error ${res.status}`);
    }
  }
}
