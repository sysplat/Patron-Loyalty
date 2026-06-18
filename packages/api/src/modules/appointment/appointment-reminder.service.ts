import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class AppointmentReminderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly notifications: NotificationService,
  ) {}

  /**
   * Sends appointment reminders for appointments entering the configured reminder window.
   * Deduplication uses Redis keys so the scheduled task can run frequently without
   * repeatedly notifying the same customer.
   *
   * Pass `orgId` to scope the scan to a single tenant — the scheduled-jobs worker
   * fans out one job per org so reminder delivery parallelizes across replicas.
   */
  async sendDueReminders(orgId?: string): Promise<number> {
    const reminderThresholdsRaw = this.config.get<string>(
      'APPOINTMENT_REMINDER_MINUTES',
      '1440,60',
    );
    const thresholds = reminderThresholdsRaw
      .split(',')
      .map((s) => Number.parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0);
    const scanWindowMinutes = Number.parseInt(
      this.config.get<string>('APPOINTMENT_REMINDER_SCAN_WINDOW_MINUTES', '15'),
      10,
    );

    if (thresholds.length === 0) return 0;

    let totalSent = 0;
    const now = new Date();

    for (const reminderMinutes of thresholds) {
      const windowStart = new Date(now.getTime() + reminderMinutes * 60 * 1000);
      const windowEnd = new Date(
        windowStart.getTime() + Math.max(scanWindowMinutes, 5) * 60 * 1000,
      );

      const appointments = await this.prisma.withBypassRls((tx) =>
        tx.appointment.findMany({
          where: {
            ...(orgId ? { orgId } : {}),
            status: { in: ['pending', 'confirmed'] },
            scheduledAt: { gte: windowStart, lt: windowEnd },
            OR: [{ customerPhone: { not: null } }, { customerEmail: { not: null } }],
          },
          include: {
            branch: { select: { name: true } },
            service: { select: { name: true } },
          },
          take: 250,
        }),
      );

      for (const appointment of appointments) {
        const dedupeKey = `notification:appointment:${appointment.id}:reminder:${reminderMinutes}`;
        const alreadySent = await this.redis.get(dedupeKey);
        if (alreadySent) continue;

        let transactionalSmsAllowed = false;
        if (appointment.customerPhone) {
          const customer = await this.prisma.withTenant(appointment.orgId, (tx) =>
            tx.customer.findFirst({
              where: { orgId: appointment.orgId, phone: appointment.customerPhone },
              select: { transactionalSmsAllowed: true },
            }),
          );
          if (customer) {
            transactionalSmsAllowed = customer.transactionalSmsAllowed;
          }
        }

        await this.notifications.notifyAppointmentReminder(appointment.orgId, {
          appointmentId: appointment.id,
          customerPhone: appointment.customerPhone,
          customerEmail: appointment.customerEmail,
          customerName: appointment.customerName,
          serviceName: appointment.service.name,
          scheduledAt: appointment.scheduledAt,
          branchName: appointment.branch.name,
          transactionalSmsAllowed,
        });
        await this.redis.set(dedupeKey, 'sent', 14 * 24 * 60 * 60);
        totalSent += 1;
      }
    }

    return totalSent;
  }
}
