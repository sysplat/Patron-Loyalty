import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  branchAvailabilityMessage,
  evaluateAppointmentSlotAgainstWindow,
  evaluateBranchAvailabilityAtInstant,
  getDateKeyInTimeZone,
  getUtcRangeForZonedDate,
  intervalsOverlap,
  normalizeIsoDateKey,
  resolveWindowUtcBounds,
  toSchemaDayOfWeekFromIsoDate,
  type BranchAvailabilityEvaluation,
  type BranchAvailabilityReason,
  type BranchHoursWindow,
  normalizeTimeZone,
  zonedDateTimeToUtc,
} from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';

export type BranchOperationalGate = 'customer_intake' | 'queue_status_only';

@Injectable()
export class BranchHoursService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveBranchTimeZone(
    orgId: string,
    branchId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    const load = async (client: Prisma.TransactionClient) => {
      const branch = await client.branch.findUnique({
        where: { id: branchId, orgId },
        select: { timezone: true },
      });
      if (!branch) {
        throw new NotFoundException('Branch not found');
      }
      return normalizeTimeZone(branch.timezone);
    };

    if (tx) {
      return load(tx);
    }
    return this.prisma.withTenant(orgId, load);
  }

  async getWorkingHoursWindowForLocalDate(
    orgId: string,
    branchId: string,
    localDate: string,
    tx?: Prisma.TransactionClient,
  ): Promise<BranchHoursWindow | null> {
    const normalizedDate = normalizeIsoDateKey(localDate);
    const load = async (client: Prisma.TransactionClient) => {
      const dateOverride = await client.branchDateOverride.findUnique({
        where: {
          branchId_date: {
            branchId,
            date: this.isoDateToUtcDate(normalizedDate),
          },
        },
        select: {
          openTime: true,
          closeTime: true,
          isClosed: true,
          breakStart: true,
          breakEnd: true,
        },
      });

      if (dateOverride) {
        if (dateOverride.isClosed || !dateOverride.openTime || !dateOverride.closeTime) {
          return null;
        }
        return {
          openTime: dateOverride.openTime,
          closeTime: dateOverride.closeTime,
          isClosed: dateOverride.isClosed,
          breakStart: dateOverride.breakStart,
          breakEnd: dateOverride.breakEnd,
        };
      }

      const dayOfWeek = toSchemaDayOfWeekFromIsoDate(normalizedDate);
      const hours = await client.workingHours.findUnique({
        where: { branchId_dayOfWeek: { branchId, dayOfWeek } },
        select: {
          openTime: true,
          closeTime: true,
          isClosed: true,
          breakStart: true,
          breakEnd: true,
        },
      });

      if (!hours || hours.isClosed) {
        return null;
      }

      return hours;
    };

    if (tx) {
      return load(tx);
    }
    return this.prisma.withTenant(orgId, load);
  }

  async evaluateBranchAvailability(
    orgId: string,
    branchId: string,
    at: Date = new Date(),
    tx?: Prisma.TransactionClient,
  ): Promise<BranchAvailabilityEvaluation> {
    const timeZone = await this.resolveBranchTimeZone(orgId, branchId, tx);
    const localDate = getDateKeyInTimeZone(at, timeZone);
    const window = await this.getWorkingHoursWindowForLocalDate(orgId, branchId, localDate, tx);
    return evaluateBranchAvailabilityAtInstant(at, timeZone, window, localDate);
  }

  async assertBranchAcceptsCustomerIntake(
    orgId: string,
    branchId: string,
    actionLabel: string,
    at: Date = new Date(),
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const availability = await this.evaluateBranchAvailability(orgId, branchId, at, tx);
    if (availability.isOpen) {
      return;
    }
    throw new BadRequestException(
      branchAvailabilityMessage(availability.reason, actionLabel, availability.window),
    );
  }

  async assertAppointmentSlotWithinWorkingHours(
    orgId: string,
    branchId: string,
    branchTimeZone: string,
    scheduledAt: Date,
    durationMinutes: number,
  ): Promise<void> {
    const localDate = getDateKeyInTimeZone(scheduledAt, branchTimeZone);
    const window = await this.getWorkingHoursWindowForLocalDate(orgId, branchId, localDate);
    const reason = evaluateAppointmentSlotAgainstWindow(
      scheduledAt,
      durationMinutes,
      branchTimeZone,
      window,
      localDate,
    );

    if (reason === 'open') {
      return;
    }

    const messages: Record<Exclude<BranchAvailabilityReason, 'open'>, string> = {
      closed_day: 'The selected branch is closed on that day',
      outside_hours: 'The selected appointment time is outside branch working hours',
      break: 'The selected appointment time overlaps the branch break window',
      no_schedule: 'No operating schedule is configured for this branch on that day',
    };
    throw new BadRequestException(messages[reason]);
  }

  getUtcRangeForZonedDate(date: string, timeZone: string) {
    return getUtcRangeForZonedDate(normalizeIsoDateKey(date), timeZone);
  }

  zonedDateTimeToUtc(date: string, time: string, timeZone: string): Date {
    return zonedDateTimeToUtc(normalizeIsoDateKey(date), time, timeZone);
  }

  resolveWindowUtcBounds(localDate: string, window: BranchHoursWindow, timeZone: string) {
    return resolveWindowUtcBounds(normalizeIsoDateKey(localDate), window, timeZone);
  }

  intervalsOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
    return intervalsOverlap(startA, endA, startB, endB);
  }

  private isoDateToUtcDate(date: string): Date {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
  }
}
