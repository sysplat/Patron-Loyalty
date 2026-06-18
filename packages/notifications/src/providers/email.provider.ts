import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';
import { DEFAULT_NOREPLY_EMAIL, PRODUCT_NAME } from '@queueplatform/shared';

/** Pull bare email from `addr` or `Display Name <addr>`. */
function parseFromEmail(from: string): string {
  const m = from.trim().match(/<([^>]+)>\s*$/);
  if (m) return m[1].trim();
  return from.trim();
}

function serializeEmailSendError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const anyErr = err as Error & { response?: { body?: unknown; statusCode?: number } };
  const status = anyErr.response?.statusCode;
  const body = anyErr.response?.body;
  if (body != null) {
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    return status != null ? `${err.message} [HTTP ${status}] ${text}` : `${err.message} ${text}`;
  }
  return err.message;
}

/**
 * Email delivery for the notification worker.
 *
 * When `TWILIO_SENDGRID_API_KEY` / `SENDGRID_API_KEY` is set, prefers SendGrid's **HTTP API**
 * (`@sendgrid/mail`) so delivery does not depend on outbound SMTP (587) from the host —
 * Railway and other clouds often see SMTP connection timeouts while HTTPS to api.sendgrid.com works.
 *
 * Falls back to Nodemailer SMTP for generic relays (`SMTP_*`) or local Mailpit (`localhost:1025`).
 *
 * Side-effect on construction: sets `process.env.EMAIL_FROM` to the resolved from-address.
 */
export class EmailProvider {
  private readonly sendGridApiKey: string | undefined;
  private readonly provider: string;
  private readonly transporter: nodemailer.Transporter | null;

  constructor() {
    const sendGridApiKey = process.env.TWILIO_SENDGRID_API_KEY ?? process.env.SENDGRID_API_KEY;
    const sendGridFrom = process.env.TWILIO_SENDGRID_FROM_EMAIL ?? process.env.SENDGRID_FROM_EMAIL;
    this.provider = process.env.EMAIL_PROVIDER || 'smtp';

    this.sendGridApiKey = sendGridApiKey?.trim() || undefined;

    if (this.sendGridApiKey) {
      sgMail.setApiKey(this.sendGridApiKey);
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

    process.env.EMAIL_FROM = sendGridFrom ?? process.env.EMAIL_FROM ?? DEFAULT_NOREPLY_EMAIL;
  }

  async send(data: {
    to: string;
    subject: string;
    body: string;
  }): Promise<{ success: boolean; providerMessageId?: string; error?: string }> {
    const from = process.env.EMAIL_FROM ?? DEFAULT_NOREPLY_EMAIL;

    try {
      if (this.sendGridApiKey) {
        const fromEmail = parseFromEmail(from);
        const [res] = await sgMail.send({
          to: data.to,
          from: { email: fromEmail, name: PRODUCT_NAME },
          subject: data.subject,
          text: data.body,
          html: data.body.includes('<') ? data.body : data.body.split('\n').join('<br>\n'),
        });
        const id = res.headers['x-message-id'] as string | undefined;
        return { success: true, providerMessageId: id ?? res.statusCode?.toString() };
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
        html: data.body.includes('<') ? data.body : data.body.split('\n').join('<br>\n'),
      });
      return { success: true, providerMessageId: info.messageId };
    } catch (err: unknown) {
      return { success: false, error: serializeEmailSendError(err) };
    }
  }
}
