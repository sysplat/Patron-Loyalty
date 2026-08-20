import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';
import { Resend } from 'resend';
import { DEFAULT_NOREPLY_EMAIL, PRODUCT_NAME } from '@queueplatform/shared';

/** Treat unset/blank env vars as missing (Railway often stores cleared keys as ""). */
function nonEmptyEnv(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

/** Pull bare email from `addr` or `Display Name <addr>`. */
function parseFromEmail(from: string): string {
  const m = from.trim().match(/<([^>]+)>\s*$/);
  if (m) return m[1].trim();
  return from.trim();
}

function formatFromAddress(from: string): string {
  const trimmed = from.trim();
  const email = parseFromEmail(trimmed) || parseFromEmail(DEFAULT_NOREPLY_EMAIL);
  if (trimmed.includes('<') && parseFromEmail(trimmed)) {
    return trimmed;
  }
  return `${PRODUCT_NAME} <${email}>`;
}

function serializeEmailSendError(err: unknown): string {
  if (err instanceof Error) {
    const anyErr = err as Error & { response?: { body?: unknown; statusCode?: number } };
    const status = anyErr.response?.statusCode;
    const body = anyErr.response?.body;
    if (body != null) {
      const text = typeof body === 'string' ? body : JSON.stringify(body);
      return status != null ? `${err.message} [HTTP ${status}] ${text}` : `${err.message} ${text}`;
    }
    return err.message;
  }
  if (typeof err === 'object' && err !== null) {
    const record = err as { message?: unknown; name?: unknown; statusCode?: unknown };
    if (typeof record.message === 'string') {
      const name = typeof record.name === 'string' ? record.name : 'provider_error';
      const status = typeof record.statusCode === 'number' ? ` [HTTP ${record.statusCode}]` : '';
      return `${name}${status}: ${record.message}`;
    }
    return JSON.stringify(err);
  }
  return String(err);
}

function htmlBody(body: string): string {
  return body.includes('<') ? body : body.split('\n').join('<br>\n');
}

/**
 * Email delivery for the notification worker.
 *
 * Priority when sending:
 * 1. SendGrid HTTPS (`TWILIO_SENDGRID_API_KEY` / `SENDGRID_API_KEY`)
 * 2. Resend HTTPS (`RESEND_API_KEY`) — avoids Railway SMTP timeouts
 * 3. Nodemailer SMTP (`SMTP_*`) or local Mailpit (`localhost:1025`)
 * 4. Console (`EMAIL_PROVIDER=console`)
 *
 * Side-effect on construction: sets `process.env.EMAIL_FROM` to the resolved from-address.
 */
export class EmailProvider {
  private readonly sendGridApiKey: string | undefined;
  private readonly resendClient: Resend | null;
  private readonly provider: string;
  private readonly transporter: nodemailer.Transporter | null;

  constructor() {
    const sendGridApiKey = process.env.TWILIO_SENDGRID_API_KEY ?? process.env.SENDGRID_API_KEY;
    const resendApiKey = process.env.RESEND_API_KEY;
    const sendGridFrom =
      nonEmptyEnv(process.env.TWILIO_SENDGRID_FROM_EMAIL) ??
      nonEmptyEnv(process.env.SENDGRID_FROM_EMAIL);
    const resendFrom = nonEmptyEnv(process.env.RESEND_FROM_EMAIL);
    this.provider = process.env.EMAIL_PROVIDER || 'smtp';

    this.sendGridApiKey = sendGridApiKey?.trim() || undefined;
    const trimmedResendKey = resendApiKey?.trim() || undefined;
    this.resendClient = trimmedResendKey ? new Resend(trimmedResendKey) : null;

    if (this.sendGridApiKey) {
      sgMail.setApiKey(this.sendGridApiKey);
      this.transporter = null;
    } else if (this.resendClient) {
      this.transporter = null;
    } else if (this.provider === 'smtp') {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST ?? 'localhost',
        port: parseInt(process.env.SMTP_PORT ?? '1025', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' }
          : undefined,
        connectionTimeout: 20_000,
        greetingTimeout: 15_000,
        socketTimeout: 45_000,
      });
    } else {
      this.transporter = null;
    }

    process.env.EMAIL_FROM =
      sendGridFrom ?? resendFrom ?? nonEmptyEnv(process.env.EMAIL_FROM) ?? DEFAULT_NOREPLY_EMAIL;
  }

  async send(data: {
    to: string;
    subject: string;
    body: string;
  }): Promise<{ success: boolean; providerMessageId?: string; error?: string }> {
    const from = nonEmptyEnv(process.env.EMAIL_FROM) ?? DEFAULT_NOREPLY_EMAIL;

    try {
      if (this.sendGridApiKey) {
        const fromEmail = parseFromEmail(from);
        const [res] = await sgMail.send({
          to: data.to,
          from: { email: fromEmail, name: PRODUCT_NAME },
          subject: data.subject,
          text: data.body,
          html: htmlBody(data.body),
        });
        const id = res.headers['x-message-id'] as string | undefined;
        return { success: true, providerMessageId: id ?? res.statusCode?.toString() };
      }

      if (this.resendClient) {
        const { data: resendData, error } = await this.resendClient.emails.send({
          from: formatFromAddress(from),
          to: data.to,
          subject: data.subject,
          text: data.body,
          html: htmlBody(data.body),
        });
        if (error) {
          return { success: false, error: serializeEmailSendError(error) };
        }
        return { success: true, providerMessageId: resendData?.id };
      }

      if (this.provider === 'console') {
        console.log('\n--- EMAIL SENT (CONSOLE PROVIDER) ---');
        console.log(`From:    ${from}`);
        console.log(`To:      ${data.to}`);
        console.log(`Subject: ${data.subject}`);
        console.log('Body:');
        console.log(data.body);
        console.log('--------------------------------------\n');
        return { success: true, providerMessageId: `console-${Date.now()}` };
      }

      if (!this.transporter) {
        throw new Error(
          'Email provider is not configured properly (no SMTP transporter). Set EMAIL_PROVIDER=console for local testing.',
        );
      }

      const info = await this.transporter.sendMail({
        from,
        to: data.to,
        subject: data.subject,
        text: data.body,
        html: htmlBody(data.body),
      });
      return { success: true, providerMessageId: info.messageId };
    } catch (err: unknown) {
      return { success: false, error: serializeEmailSendError(err) };
    }
  }
}
