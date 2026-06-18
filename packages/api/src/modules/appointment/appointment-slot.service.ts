import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { normalizeTimeZone } from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { BranchHoursService } from '../branch/branch-hours.service';
import type { ServiceBookingConfig } from './appointment.types';

@Injectable()
export class AppointmentSlotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchHours: BranchHoursService,
  ) {}

  async getAvailableSlots(
    branchId: string,
    serviceId: string,
    date: string,
    subServiceId?: string,
  ) {
    const branch = await this.prisma.withBypassRls((tx) =>
      tx.branch.findUnique({
        where: { id: branchId },
        select: { orgId: true, timezone: true },
      }),
    );
    if (!branch) throw new NotFoundException('Branch not found');
    const branchTimeZone = normalizeTimeZone(branch.timezone);

    const service = await this.getBookableService(branch.orgId, serviceId);
    const branchService = await this.prisma.withTenant(branch.orgId, (tx) =>
      tx.branchService.findUnique({
        where: { branchId_serviceId: { branchId, serviceId } },
        select: {
          isActive: true,
          customServiceEstimateLowMinutes: true,
          customServiceEstimateHighMinutes: true,
        },
      }),
    );

    if (!branchService || !branchService.isActive) {
      throw new BadRequestException(
        'This appointment service is not available at the selected branch',
      );
    }

    const subService = subServiceId
      ? await this.prisma.withTenant(branch.orgId, (tx) =>
          tx.subService.findFirst({
            where: { id: subServiceId, serviceId, status: 'active' },
            select: { durationMinutes: true },
          }),
        )
      : null;

    if (subServiceId && !subService) {
      throw new NotFoundException('Sub-service not found');
    }

    const durationMinutes = this.resolveAppointmentDurationMinutes(
      service,
      branchService.customServiceEstimateLowMinutes ?? null,
      branchService.customServiceEstimateHighMinutes ?? null,
      subService?.durationMinutes ?? null,
    );
    const slotIntervalMinutes = service.appointmentSlotInterval ?? durationMinutes;
    const normalizedDate = this.normalizeIsoDate(date);
    const { start: dayStart, end: dayEnd } = this.branchHours.getUtcRangeForZonedDate(
      normalizedDate,
      branchTimeZone,
    );
    this.validateAdvanceSearchWindow(dayEnd, service.appointmentMaxAdvanceDays);

    const workingHours = await this.branchHours.getWorkingHoursWindowForLocalDate(
      branch.orgId,
      branchId,
      normalizedDate,
    );
    if (!workingHours) {
      return [];
    }

    const existing = await this.prisma.withTenant(branch.orgId, (tx) =>
      tx.appointment.findMany({
        where: {
          branchId,
          serviceId,
          scheduledAt: { gte: dayStart, lte: dayEnd },
          status: { notIn: ['cancelled', 'no_show'] },
        },
        select: { scheduledAt: true, durationMinutes: true },
      }),
    );

    const { openAtUtc, closeAtUtc, breakStartUtc, breakEndUtc } =
      this.branchHours.resolveWindowUtcBounds(normalizedDate, workingHours, branchTimeZone);
    const openAt = openAtUtc!;
    const closeAt = closeAtUtc!;
    const breakStart = breakStartUtc;
    const breakEnd = breakEndUtc;
    const now = new Date();
    const earliestAllowed = new Date(
      now.getTime() + service.appointmentLeadTimeMinutes * 60 * 1000,
    );
    const slots: string[] = [];

    for (
      let cursor = new Date(openAt);
      cursor < closeAt;
      cursor = new Date(cursor.getTime() + slotIntervalMinutes * 60 * 1000)
    ) {
      const slotEnd = new Date(cursor.getTime() + durationMinutes * 60 * 1000);

      if (slotEnd > closeAt) {
        continue;
      }

      if (cursor < earliestAllowed) {
        continue;
      }

      if (
        breakStart &&
        breakEnd &&
        this.branchHours.intervalsOverlap(cursor, slotEnd, breakStart, breakEnd)
      ) {
        continue;
      }

      const hasConflict = existing.some((appointment) => {
        const appointmentStart = appointment.scheduledAt;
        const appointmentEnd = new Date(
          appointmentStart.getTime() +
            appointment.durationMinutes * 60 * 1000 +
            service.appointmentBufferMinutes * 60 * 1000,
        );
        const candidateEnd = new Date(
          slotEnd.getTime() + service.appointmentBufferMinutes * 60 * 1000,
        );

        return this.branchHours.intervalsOverlap(
          cursor,
          candidateEnd,
          appointmentStart,
          appointmentEnd,
        );
      });

      if (!hasConflict) {
        slots.push(cursor.toISOString());
      }
    }

    return slots;
  }

  async getBookableService(orgId: string, serviceId: string): Promise<ServiceBookingConfig> {
    const service = await this.prisma.withTenant(orgId, (tx) =>
      tx.service.findFirst({
        where: { id: serviceId, orgId, status: 'active', appointmentEnabled: true },
        select: {
          id: true,
          name: true,
          durationMinutes: true,
          queueEnabled: true,
          serviceEstimateLowMinutes: true,
          serviceEstimateHighMinutes: true,
          appointmentEnabled: true,
          appointmentSlotInterval: true,
          appointmentLeadTimeMinutes: true,
          appointmentMaxAdvanceDays: true,
          appointmentBufferMinutes: true,
          appointmentRequiresEmail: true,
        },
      }),
    );

    if (!service || !service.appointmentEnabled) {
      throw new NotFoundException('Appointment service not found');
    }

    return service;
  }

  resolveAppointmentDurationMinutes(
    service: Pick<
      ServiceBookingConfig,
      | 'durationMinutes'
      | 'queueEnabled'
      | 'serviceEstimateLowMinutes'
      | 'serviceEstimateHighMinutes'
    >,
    branchEstimateLow: number | null,
    branchEstimateHigh: number | null,
    subServiceDuration: number | null,
  ): number {
    if (
      subServiceDuration != null &&
      Number.isFinite(subServiceDuration) &&
      subServiceDuration >= 1
    ) {
      return Math.round(subServiceDuration);
    }
    const low = branchEstimateLow ?? service.serviceEstimateLowMinutes;
    const high = branchEstimateHigh ?? service.serviceEstimateHighMinutes;
    if (
      service.queueEnabled &&
      low !== null &&
      high !== null &&
      Number.isFinite(low) &&
      Number.isFinite(high) &&
      low >= 1 &&
      high >= low
    ) {
      return Math.round((low + high) / 2);
    }
    const d = service.durationMinutes;
    if (d != null && Number.isFinite(d) && d >= 1) return Math.round(d);
    return 30;
  }

  validateAdvanceWindow(scheduledAt: Date, leadTimeMinutes: number, maxAdvanceDays: number): void {
    const now = new Date();
    const earliestAllowed = new Date(now.getTime() + leadTimeMinutes * 60 * 1000);
    const latestAllowed = new Date(now.getTime() + maxAdvanceDays * 24 * 60 * 60 * 1000);

    if (scheduledAt < earliestAllowed) {
      throw new BadRequestException('This appointment time is too soon to book');
    }

    if (scheduledAt > latestAllowed) {
      throw new BadRequestException('This appointment time is outside the advance booking window');
    }
  }

  validateAdvanceSearchWindow(dayEnd: Date, maxAdvanceDays: number): void {
    const latestAllowed = new Date(Date.now() + maxAdvanceDays * 24 * 60 * 60 * 1000);

    if (dayEnd > latestAllowed) {
      throw new BadRequestException('This appointment date is outside the advance booking window');
    }
  }

  async ensureSlotWithinWorkingHours(
    orgId: string,
    branchId: string,
    branchTimeZone: string,
    scheduledAt: Date,
    durationMinutes: number,
  ): Promise<void> {
    await this.branchHours.assertAppointmentSlotWithinWorkingHours(
      orgId,
      branchId,
      branchTimeZone,
      scheduledAt,
      durationMinutes,
    );
  }

  async findOverlappingAppointment(
    tx: Prisma.TransactionClient,
    input: {
      branchId: string;
      serviceId: string;
      scheduledAt: Date;
      durationMinutes: number;
      bufferMinutes: number;
    },
  ) {
    const dayStart = new Date(input.scheduledAt);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(input.scheduledAt);
    dayEnd.setHours(23, 59, 59, 999);
    const scheduledEnd = new Date(
      input.scheduledAt.getTime() + (input.durationMinutes + input.bufferMinutes) * 60 * 1000,
    );
    const appointments = await tx.appointment.findMany({
      where: {
        branchId: input.branchId,
        serviceId: input.serviceId,
        scheduledAt: { gte: dayStart, lte: dayEnd },
        status: { notIn: ['cancelled', 'no_show'] },
      },
      select: { id: true, scheduledAt: true, durationMinutes: true },
    });

    return (
      appointments.find(
        (appointment: { id: string; scheduledAt: Date; durationMinutes: number }) => {
          const appointmentEnd = new Date(
            appointment.scheduledAt.getTime() +
              (appointment.durationMinutes + input.bufferMinutes) * 60 * 1000,
          );
          return this.branchHours.intervalsOverlap(
            input.scheduledAt,
            scheduledEnd,
            appointment.scheduledAt,
            appointmentEnd,
          );
        },
      ) ?? null
    );
  }

  formatInTimeZone(date: Date, timeZone: string, options: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat('en-US', {
      ...options,
      timeZone,
    }).format(date);
  }

  private normalizeIsoDate(date: string): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!match) {
      throw new BadRequestException('Invalid appointment date');
    }

    const normalized = `${match[1]}-${match[2]}-${match[3]}`;
    const [year, month, day] = normalized.split('-').map(Number);
    const utcDate = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
    const isoFromUtc = `${utcDate.getUTCFullYear()}-${String(utcDate.getUTCMonth() + 1).padStart(2, '0')}-${String(utcDate.getUTCDate()).padStart(2, '0')}`;
    if (Number.isNaN(utcDate.getTime()) || isoFromUtc !== normalized) {
      throw new BadRequestException('Invalid appointment date');
    }

    return normalized;
  }
}
