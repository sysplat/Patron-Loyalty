import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { NotificationService } from '../notification/notification.service';
import { RedisService } from '../../redis/redis.service';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { AppointmentQueryService } from './appointment-query.service';
import { AppointmentAnalyticsService } from './appointment-analytics.service';
import { AppointmentSlotService } from './appointment-slot.service';
import { BranchHoursService } from '../branch/branch-hours.service';
import { AppointmentBookingService } from './appointment-booking.service';
import { AppointmentPublicService } from './appointment-public.service';
import { AppointmentReminderService } from './appointment-reminder.service';
import { AppointmentLifecycleService } from './appointment-lifecycle.service';
import type { AppointmentBookingInput, AppointmentFilters } from './appointment.types';

/**
 * Thin facade over bounded appointment domain services.
 * Handles booking, slot management, confirmation, and cancellation.
 */
@Injectable()
export class AppointmentService {
  private readonly logger = new Logger(AppointmentService.name);
  private readonly query: AppointmentQueryService;
  private readonly analytics: AppointmentAnalyticsService;
  private readonly slots: AppointmentSlotService;
  private readonly booking: AppointmentBookingService;
  private readonly publicApi: AppointmentPublicService;
  private readonly reminders: AppointmentReminderService;
  private readonly lifecycle: AppointmentLifecycleService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly requestContext: RequestContextService,
    query?: AppointmentQueryService,
    analytics?: AppointmentAnalyticsService,
    slots?: AppointmentSlotService,
    booking?: AppointmentBookingService,
    publicApi?: AppointmentPublicService,
    reminders?: AppointmentReminderService,
    lifecycle?: AppointmentLifecycleService,
  ) {
    this.query = query ?? new AppointmentQueryService(this.prisma);
    this.analytics = analytics ?? new AppointmentAnalyticsService(this.prisma);
    this.slots =
      slots ?? new AppointmentSlotService(this.prisma, new BranchHoursService(this.prisma));
    this.booking =
      booking ??
      new AppointmentBookingService(
        this.prisma,
        this.notifications,
        this.audit,
        this.requestContext,
        this.slots,
      );
    this.publicApi = publicApi ?? new AppointmentPublicService(this.prisma, this.audit);
    this.reminders =
      reminders ??
      new AppointmentReminderService(this.prisma, this.config, this.redis, this.notifications);
    this.lifecycle =
      lifecycle ??
      new AppointmentLifecycleService(this.prisma, this.audit, this.query, new EventEmitter2());
  }

  list(orgId: string, filters: AppointmentFilters) {
    return this.query.list(orgId, filters);
  }

  listForPrincipal(
    orgId: string,
    userId: string,
    filters: Omit<AppointmentFilters, 'allowedBranchIds'>,
  ) {
    return this.query.listForPrincipal(orgId, userId, filters);
  }

  getAnalyticsSummary(
    orgId: string,
    opts: {
      dateFrom: string;
      dateTo: string;
      branchId?: string;
      serviceId?: string;
      allowedBranchIds?: string[] | null;
    },
  ) {
    return this.analytics.getAnalyticsSummary(orgId, opts);
  }

  getAnalyticsSummaryForPrincipal(
    orgId: string,
    userId: string,
    opts: { dateFrom: string; dateTo: string; branchId?: string; serviceId?: string },
  ) {
    return this.analytics.getAnalyticsSummaryForPrincipal(orgId, userId, opts);
  }

  getById(orgId: string, id: string) {
    return this.query.getById(orgId, id);
  }

  book(data: AppointmentBookingInput) {
    return this.booking.book(data);
  }

  sendDueReminders(orgId?: string) {
    return this.reminders.sendDueReminders(orgId);
  }

  getPublicById(id: string) {
    return this.publicApi.getPublicById(id);
  }

  cancelPublic(id: string) {
    return this.publicApi.cancelPublic(id);
  }

  update(
    orgId: string,
    id: string,
    actorUserId: string | undefined,
    data: { status?: string; assignedUserId?: string; notes?: string },
  ) {
    return this.lifecycle.update(orgId, id, actorUserId, data);
  }

  delete(orgId: string, id: string, actorUserId?: string) {
    return this.lifecycle.delete(orgId, id, actorUserId);
  }

  getAvailableSlots(branchId: string, serviceId: string, date: string, subServiceId?: string) {
    return this.slots.getAvailableSlots(branchId, serviceId, date, subServiceId);
  }

  customerLookup(branchId: string, email?: string, phone?: string) {
    return this.publicApi.customerLookup(branchId, email, phone);
  }
}
