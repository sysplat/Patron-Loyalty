import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import pino from 'pino';
import { EmailProvider } from './providers/email.provider';
import { SmsProvider } from './providers/sms.provider';
import {
  decorateTransactionalSmsBody,
  isBillableSmsProviderMessageId,
  smsLifetimeUsageKey,
} from '@queueplatform/shared';
import { PrismaClient } from '@queueplatform/database';
import { captureNotificationJobFailure, flushSentry, initSentry } from './sentry';
import {
  NOTIFICATIONS_DEAD_QUEUE_NAME,
  copyExhaustedNotificationJobToDeadLetter,
} from './queue-dead-letter';

const packageRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(packageRoot, '..', '..');

for (const envPath of [
  path.join(workspaceRoot, '.env'),
  path.join(packageRoot, '.env'),
  path.join(workspaceRoot, 'packages', 'api', '.env'),
]) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
  }
}

initSentry();

const logger = pino({ name: 'notification-worker' });

const redis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const prisma = new PrismaClient();
const emailProvider = new EmailProvider();
const smsProvider = new SmsProvider();

const emailProviderName = process.env.EMAIL_PROVIDER || 'smtp';
const sendGridKeyPresent = Boolean(
  (process.env.TWILIO_SENDGRID_API_KEY ?? process.env.SENDGRID_API_KEY)?.trim(),
);

logger.info(
  sendGridKeyPresent
    ? {
        emailTransport: 'sendgrid-https',
        emailFrom: process.env.EMAIL_FROM ?? process.env.TWILIO_SENDGRID_FROM_EMAIL ?? '(unset)',
      }
    : {
        emailTransport: emailProviderName,
        smtpHost: emailProviderName === 'smtp' ? (process.env.SMTP_HOST ?? 'localhost') : undefined,
        smtpPort: emailProviderName === 'smtp' ? (process.env.SMTP_PORT ?? '1025') : undefined,
        emailFrom: process.env.EMAIL_FROM ?? '(unset)',
      },
  'Email delivery configuration (startup)',
);

const deadLetterQueue = new Queue(NOTIFICATIONS_DEAD_QUEUE_NAME, { connection: redis });

const worker = new Worker(
  'notifications',
  async (job) => {
    const {
      notificationId,
      orgId,
      channel,
      to,
      templateId,
      subject,
      body,
      variables,
      requestId,
      applyTransactionalSmsFooter,
      organizationNameForSms,
    } = job.data;
    logger.info({ notificationId, orgId, channel, to, requestId }, 'Processing notification');

    try {
      let finalBody = body;
      let finalSubject = subject;

      // Resolve template if provided; fall back to inline body when template is missing/empty.
      if (templateId) {
        const template = await prisma.notificationTemplate.findUnique({
          where: { id: templateId },
        });
        if (template?.body?.trim()) {
          finalBody = template.body;
          finalSubject = template.subject ?? subject;
          if (variables) {
            for (const [key, value] of Object.entries(variables)) {
              finalBody = finalBody?.replace(new RegExp(`{{${key}}}`, 'g'), value as string);
              if (finalSubject)
                finalSubject = finalSubject.replace(new RegExp(`{{${key}}}`, 'g'), value as string);
            }
          }
        }
      }
      if (!finalBody?.trim()) {
        finalBody = body;
      }
      if (channel === 'sms' && applyTransactionalSmsFooter && finalBody) {
        finalBody = decorateTransactionalSmsBody(
          finalBody,
          organizationNameForSms || 'Your organization',
        );
      }

      let result: { success: boolean; providerMessageId?: string; error?: string };

      switch (channel) {
        case 'email':
          result = await emailProvider.send({
            to,
            subject: finalSubject ?? 'Notification',
            body: finalBody ?? '',
          });
          break;
        case 'sms':
          result = await smsProvider.send({ to, body: finalBody ?? '' });
          break;
        case 'whatsapp':
          result = await smsProvider.sendWhatsApp({ to, body: finalBody ?? '' });
          break;
        case 'push':
          // Push notifications are not yet implemented — log and mark as delivered
          logger.warn(
            { notificationId, orgId, requestId },
            'Push notification requested but not implemented; marking as delivered (noop)',
          );
          result = { success: true, providerMessageId: 'push-noop' };
          break;
        default:
          result = { success: false, error: `Unknown channel: ${channel}` };
      }

      // Update notification status — store providerMessageId so the
      // Twilio status-callback webhook can look up this record later.
      const existingNotification = await prisma.notification.findUnique({
        where: { id: notificationId },
      });

      if (!existingNotification) {
        logger.warn(
          { notificationId, orgId, requestId },
          'Notification record not found during status update (likely deleted or rolled back)',
        );
        return;
      }

      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: result.success ? 'sent' : 'failed',
          sentAt: result.success ? new Date() : undefined,
          errorMessage: result.error,
          ...(result.providerMessageId ? { providerMessageId: result.providerMessageId } : {}),
        },
      });

      if (
        channel === 'sms' &&
        orgId &&
        result.success &&
        isBillableSmsProviderMessageId(result.providerMessageId)
      ) {
        const billableCount = await prisma.notification.count({
          where: {
            orgId,
            channel: 'sms',
            status: { in: ['sent', 'delivered'] },
            providerMessageId: { startsWith: 'SM' },
          },
        });
        await redis.set(smsLifetimeUsageKey(orgId), String(billableCount));
      }

      // Log it
      const logMetadata = {
        channel,
        to,
        ...(requestId ? { requestId } : {}),
        ...(orgId ? { orgId } : {}),
        ...(result.providerMessageId ? { messageId: result.providerMessageId } : {}),
        ...(result.error ? { error: result.error } : {}),
      };

      await prisma.notificationLog.create({
        data: {
          notificationId,
          event: result.success ? 'delivered' : 'failed',
          metadata: logMetadata,
        },
      });

      if (!result.success) {
        logger.warn(
          { notificationId, orgId, channel, to, requestId, error: result.error },
          'Provider returned failure before job retry',
        );
        throw new Error(result.error ?? 'Notification send failed');
      }

      logger.info({ notificationId, orgId, channel, requestId }, 'Notification sent successfully');
    } catch (err) {
      logger.error({ notificationId, orgId, requestId, err }, 'Notification processing failed');
      throw err; // Let BullMQ retry
    }
  },
  {
    connection: redis,
    concurrency: 10,
    limiter: {
      max: 10,
      duration: 1000,
    },
    removeOnComplete: { count: 1_000 },
    removeOnFail: { count: 500 },
  },
);

worker.on('completed', (job) => {
  logger.debug({ jobId: job.id }, 'Job completed');
});

worker.on('failed', async (job, err) => {
  const { notificationId, orgId, requestId, channel } = job?.data ?? {};
  logger.error(
    { jobId: job?.id, notificationId, orgId, requestId, err: err.message },
    'Job failed',
  );
  captureNotificationJobFailure(err, {
    jobId: job?.id != null ? String(job.id) : undefined,
    notificationId,
    orgId,
    channel,
    requestId,
    attemptsMade: job?.attemptsMade,
  });

  if (job) {
    const copied = await copyExhaustedNotificationJobToDeadLetter(deadLetterQueue, job, err);
    if (copied) {
      logger.warn(
        { jobId: job.id, notificationId, orgId, requestId },
        'Notification job exhausted retries; copied to notifications-dead queue',
      );
    }
  }
});

logger.info('Notification worker started');

// Graceful shutdown — handles both SIGTERM (Docker/K8s) and SIGINT (Ctrl-C local)
async function shutdown() {
  logger.info('Shutting down notification worker...');
  await worker.close();
  await deadLetterQueue.close();
  await prisma.$disconnect();
  await redis.quit();
  await flushSentry();
  process.exit(0);
}

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled rejection in notification worker');
  captureNotificationJobFailure(reason instanceof Error ? reason : new Error(String(reason)), {});
  void flushSentry().finally(() => process.exit(1));
});

process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception in notification worker');
  captureNotificationJobFailure(err, {});
  void flushSentry().finally(() => process.exit(1));
});

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
