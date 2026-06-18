/**
 * SMS Provider — multi-backend transport selected via `SMS_PROVIDER`.
 * Twilio is the default provider for production-ready SMS delivery.
 *
 * Env var resolution order (Twilio):
 *   TWILIO_ACCOUNT_SID  — Account SID used in the REST URL (required for Twilio)
 *   TWILIO_AUTH_TOKEN   — Master auth token (classic auth)
 *   TWILIO_API_KEY      — API Key SID created by the CLI (preferred, more secure)
 *   TWILIO_API_SECRET   — API Key secret paired with TWILIO_API_KEY
 *   TWILIO_PHONE_NUMBER — Sender phone number (E.164 format, e.g. +19785030226)
 *
 * Legacy aliases (still supported):
 *   SMS_API_KEY → used as TWILIO_ACCOUNT_SID when TWILIO_ACCOUNT_SID is unset
 *   SMS_AUTH_TOKEN → used as TWILIO_AUTH_TOKEN when TWILIO_AUTH_TOKEN is unset
 *   SMS_SENDER → used as TWILIO_PHONE_NUMBER when TWILIO_PHONE_NUMBER is unset
 */
import { normalizeSmsRecipient } from '@queueplatform/shared';

interface SendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

interface SendInput {
  to: string;
  body: string;
  /** Optional URL Twilio will POST delivery status updates to. */
  statusCallbackUrl?: string;
}

interface KavenegarResponse {
  return?: {
    status?: number;
    message?: string;
  };
  entries?: Array<{
    messageid?: string | number;
  }>;
}

interface TwilioResponse {
  sid?: string;
  message?: string;
  code?: number;
}

interface GenericResponse {
  id?: string;
  messageId?: string;
}

export class SmsProvider {
  private readonly provider: string;
  /** Twilio Account SID (ACxxxx) — used in the REST URL */
  private readonly accountSid: string;
  /** Master auth token  — classic basic-auth credential */
  private readonly authToken: string;
  /** API Key SID (SKxxxx) created by Twilio CLI — preferred over authToken */
  private readonly twilioApiKey: string;
  /** API Key secret paired with twilioApiKey */
  private readonly twilioApiSecret: string;
  /** Kavenegar/generic legacy API key */
  private readonly legacyApiKey: string;
  private readonly sender: string;
  private readonly apiUrl: string;

  constructor() {
    this.provider = (process.env.SMS_PROVIDER ?? 'twilio').toLowerCase();
    // Twilio-specific vars (canonical) — fall back to legacy SMS_* aliases
    this.accountSid = process.env.TWILIO_ACCOUNT_SID ?? process.env.SMS_API_KEY ?? '';
    this.authToken = process.env.TWILIO_AUTH_TOKEN ?? process.env.SMS_AUTH_TOKEN ?? '';
    this.twilioApiKey = process.env.TWILIO_API_KEY ?? '';
    this.twilioApiSecret = process.env.TWILIO_API_SECRET ?? '';
    this.sender = process.env.TWILIO_PHONE_NUMBER ?? process.env.SMS_SENDER ?? '';
    this.apiUrl = process.env.SMS_API_URL ?? '';
    // Legacy key used by Kavenegar / generic providers
    this.legacyApiKey = process.env.SMS_API_KEY ?? '';
  }

  async send(data: SendInput): Promise<SendResult> {
    const recipient = normalizeSmsRecipient(data.to);
    if (!recipient) {
      return {
        success: false,
        error:
          'SMS recipient must be a valid E.164 phone number. Use +country code, e.g. +14155552671. US/Canada 10-digit numbers are also accepted.',
      };
    }

    const normalizedData = { ...data, to: recipient };

    if (this.provider === 'console') {
      console.log(
        `[SMS-DEV][${this.provider}] To: ${normalizedData.to} | Body: ${normalizedData.body}`,
      );
      return { success: true, providerMessageId: `dev-${Date.now()}` };
    }

    const isConfigured =
      this.provider === 'twilio' || this.provider === 'default'
        ? !!(
            this.accountSid &&
            this.sender &&
            (this.authToken || (this.twilioApiKey && this.twilioApiSecret))
          )
        : !!this.legacyApiKey;

    if (!isConfigured) {
      return {
        success: false,
        error: `SMS provider "${this.provider}" is not configured on the platform`,
      };
    }

    switch (this.provider) {
      case 'kavenegar':
        return this.sendKavenegar(normalizedData);
      case 'generic':
        return this.sendGeneric(normalizedData);
      case 'twilio':
      default:
        return this.sendTwilio({
          ...normalizedData,
          statusCallbackUrl: data.statusCallbackUrl ?? process.env.TWILIO_STATUS_CALLBACK_URL,
        });
    }
  }

  private async sendKavenegar(data: SendInput): Promise<SendResult> {
    const baseUrl = this.apiUrl || 'https://api.kavenegar.com/v1';
    const url = `${baseUrl}/${this.legacyApiKey}/sms/send.json`;
    const params = new URLSearchParams({
      receptor: data.to,
      message: data.body,
      sender: this.sender,
    });

    try {
      const response = await fetch(`${url}?${params.toString()}`, {
        signal: AbortSignal.timeout(10_000),
      });
      const result = (await response.json()) as KavenegarResponse;

      if (result.return?.status !== 200 && result.return?.status !== 201) {
        return {
          success: false,
          error: `Kavenegar error: ${result.return?.message ?? response.status}`,
        };
      }

      return {
        success: true,
        providerMessageId: String(result.entries?.[0]?.messageid ?? Date.now()),
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown Kavenegar error',
      };
    }
  }

  private async sendTwilio(data: SendInput): Promise<SendResult> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    // Prefer API Key auth (scoped, revokable); fall back to master auth token
    const authUser = this.twilioApiKey || this.accountSid;
    const authPass = this.twilioApiKey ? this.twilioApiSecret : this.authToken;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${authUser}:${authPass}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: this.sender,
          To: data.to,
          Body: data.body,
          ...(data.statusCallbackUrl ? { StatusCallback: data.statusCallbackUrl } : {}),
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const result = (await response.json()) as TwilioResponse;

      if (!response.ok) {
        const trialGuidance =
          result.code === 21608
            ? ' Twilio trial accounts can only send SMS to verified recipient phone numbers. Verify this destination number in Twilio or upgrade the Twilio account.'
            : '';
        return {
          success: false,
          error: `Twilio error: ${result.message ?? response.status}.${trialGuidance}`,
        };
      }

      return { success: true, providerMessageId: result.sid };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown Twilio error',
      };
    }
  }

  private async sendGeneric(data: SendInput): Promise<SendResult> {
    const url = this.apiUrl || 'https://api.sms-provider.com/send';

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.legacyApiKey}`,
        },
        body: JSON.stringify({
          from: this.sender,
          to: data.to,
          text: data.body,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        return {
          success: false,
          error: `SMS API error: ${response.status} ${await response.text()}`,
        };
      }

      const result = (await response.json()) as GenericResponse;
      return { success: true, providerMessageId: result.id ?? result.messageId };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown generic SMS error',
      };
    }
  }
}
