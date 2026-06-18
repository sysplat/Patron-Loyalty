import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CURRENT_PRIVACY_VERSION } from '@queueplatform/shared';
import { AppointmentService } from './appointment.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { attachTenantIsolationMocks } from '../../test/mock-prisma-tenant';
import { mockRequestContext } from '../../test/mock-request-context';

// ─── Prisma mock ─────────────────────────────────────────────────────────────

const mockPrisma = {
  withBypassRls: vi.fn(async (cb) => cb(mockPrisma)),
  withTenant: vi.fn(async (orgId, cb) => cb(mockPrisma)),
  organization: {
    findUnique: vi.fn(),
  },
  appointment: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  ticket: { count: vi.fn() },
  branch: { findUnique: vi.fn(), findMany: vi.fn() },
  branchService: { findUnique: vi.fn() },
  subService: { findFirst: vi.fn() },
  branchDateOverride: { findUnique: vi.fn() },
  workingHours: { findUnique: vi.fn() },
  service: { findFirst: vi.fn(), findMany: vi.fn() },
  customer: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn() },
  $transaction: vi.fn(),
};

const mockNotifications = {
  send: vi.fn().mockResolvedValue({ success: true }),
  notifyAppointmentBooked: vi.fn().mockResolvedValue({ success: true }),
  notifyAppointmentReminder: vi.fn().mockResolvedValue({ success: true }),
};

const mockAudit = {
  logActivity: vi.fn().mockResolvedValue(undefined),
  logAudit: vi.fn().mockResolvedValue(undefined),
};

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
};

const mockConfig = {
  get: vi.fn((key: string, fallback?: string) => fallback),
};

describe('AppointmentService', () => {
  let service: AppointmentService;

  beforeEach(() => {
    vi.clearAllMocks();
    attachTenantIsolationMocks(mockPrisma);
    mockPrisma.organization.findUnique.mockResolvedValue({
      timezone: 'UTC',
      name: 'Test Org',
      website: 'https://test.com',
      country: 'Canada',
      industry: 'Tech',
    });
    mockPrisma.customer.findFirst.mockResolvedValue(null);
    mockPrisma.customer.create.mockResolvedValue({ id: 'cust-1' });
    mockPrisma.customer.update.mockResolvedValue({ id: 'cust-1' });
    mockPrisma.customer.upsert.mockResolvedValue({ id: 'cust-1' });
    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: typeof mockPrisma) => unknown) => callback(mockPrisma as any),
    );
    service = new AppointmentService(
      mockPrisma as any,
      mockNotifications as any,
      mockAudit as any,
      mockRedis as any,
      mockConfig as any,
      mockRequestContext as any,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── list ──────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('returns paginated appointments', async () => {
      const appts = [{ id: 'appt-1' }];
      mockPrisma.appointment.count.mockResolvedValue(1);
      mockPrisma.appointment.findMany.mockResolvedValue(appts);

      const result = await service.list('org-1', {});

      expect(result.appointments).toEqual(appts);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('applies date range filter', async () => {
      mockPrisma.appointment.count.mockResolvedValue(0);
      mockPrisma.appointment.findMany.mockResolvedValue([]);

      await service.list('org-1', { from: '2026-01-01', to: '2026-01-31' });

      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            scheduledAt: expect.objectContaining({
              gte: expect.any(Date),
              lt: expect.any(Date),
            }),
          }),
        }),
      );
    });

    it('applies search across customer name, email, and phone', async () => {
      mockPrisma.appointment.count.mockResolvedValue(0);
      mockPrisma.appointment.findMany.mockResolvedValue([]);

      await service.list('org-1', { search: '  acme  ' });

      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                OR: expect.arrayContaining([
                  { customerName: { contains: 'acme', mode: 'insensitive' } },
                  { customerEmail: { contains: 'acme', mode: 'insensitive' } },
                  { customerPhone: { contains: 'acme', mode: 'insensitive' } },
                ]),
              }),
            ]),
          }),
        }),
      );
    });
  });

  // ── getById ───────────────────────────────────────────────────────────────

  describe('getById', () => {
    it('returns appointment when found', async () => {
      const appt = { id: 'appt-1' };
      mockPrisma.appointment.findFirst.mockResolvedValue(appt);

      expect(await service.getById('org-1', 'appt-1')).toEqual(appt);
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue(null);

      await expect(service.getById('org-1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ── book ──────────────────────────────────────────────────────────────────

  describe('book', () => {
    const futureDate = '2026-04-24T10:00:00.000Z';

    const activeBranchService = {
      isActive: true,
      customServiceEstimateLowMinutes: null as number | null,
      customServiceEstimateHighMinutes: null as number | null,
    };

    const validPayload = {
      branchId: 'branch-1',
      serviceId: 'svc-1',
      customerName: 'Alice',
      customerEmail: 'alice@example.com',
      customerPhone: '+15550001234',
      scheduledAt: futureDate,
    };

    const serviceConfig = {
      id: 'svc-1',
      name: 'Consultation',
      durationMinutes: 30,
      appointmentEnabled: true,
      appointmentSlotInterval: 30,
      appointmentLeadTimeMinutes: 0,
      appointmentMaxAdvanceDays: 30,
      appointmentBufferMinutes: 0,
      appointmentRequiresEmail: false,
    };

    beforeEach(() => {
      mockPrisma.branchService.findUnique.mockResolvedValue(activeBranchService);
      mockPrisma.subService.findFirst.mockResolvedValue(null);
      mockPrisma.branchDateOverride.findUnique.mockResolvedValue(null);
      mockPrisma.workingHours.findUnique.mockResolvedValue({
        openTime: '09:00',
        closeTime: '17:00',
        isClosed: false,
        breakStart: null,
        breakEnd: null,
      });
      mockPrisma.appointment.findMany.mockResolvedValue([]);
    });

    it('books appointment for valid future date', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-04-20T00:00:00.000Z'));

      mockPrisma.branch.findUnique.mockResolvedValue({
        orgId: 'org-1',
        id: 'branch-1',
        timezone: 'UTC',
      });
      mockPrisma.service.findFirst.mockResolvedValue(serviceConfig);
      const created = {
        id: 'appt-new',
        orgId: 'org-1',
        branchId: 'branch-1',
        serviceId: 'svc-1',
        subServiceId: null,
        scheduledAt: new Date(futureDate),
        durationMinutes: 30,
        status: 'confirmed',
      };
      mockPrisma.appointment.create.mockResolvedValue(created);

      expect(await service.book(validPayload)).toEqual(created);
    });

    it('syncs with Customer table for legal consent compliance when booking', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-04-20T00:00:00.000Z'));
      mockRequestContext.getContext.mockReturnValue({
        requestId: 'req-1',
        ip: '203.0.113.5',
        userAgent: 'Vitest Agent',
      });

      mockPrisma.branch.findUnique.mockResolvedValue({
        orgId: 'org-1',
        id: 'branch-1',
        timezone: 'UTC',
      });
      mockPrisma.service.findFirst.mockResolvedValue(serviceConfig);
      const created = {
        id: 'appt-new',
        orgId: 'org-1',
        branchId: 'branch-1',
        serviceId: 'svc-1',
        subServiceId: null,
        scheduledAt: new Date(futureDate),
        durationMinutes: 30,
        status: 'confirmed',
      };
      mockPrisma.appointment.create.mockResolvedValue(created);
      mockPrisma.customer.findFirst.mockResolvedValue(null);
      mockPrisma.customer.create.mockResolvedValue({ id: 'cust-new' });

      const payload = {
        ...validPayload,
        transactionalSmsAllowed: true,
      };

      const res = await service.book(payload);
      expect(res).toEqual(created);
      expect(mockNotifications.notifyAppointmentBooked).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({
          appointmentId: 'appt-new',
          customerPhone: '+15550001234',
          transactionalSmsAllowed: true,
        }),
      );

      expect(mockPrisma.customer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orgId: 'org-1',
          phone: '+15550001234',
          name: 'Alice',
          email: 'alice@example.com',
          transactionalSmsAllowed: true,

          smsConsentSource: 'appointment_booking',
          smsConsentVersion: CURRENT_PRIVACY_VERSION,
        }),
      });
      expect(mockAudit.logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'consent.sms.captured',
          metadata: expect.objectContaining({
            consentCaptureIp: '203.0.113.5',
            consentCaptureUserAgent: 'Vitest Agent',
          }),
        }),
      );
    });

    it('returns warning and skips SMS when org profile is incomplete', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-04-20T00:00:00.000Z'));

      mockPrisma.organization.findUnique.mockResolvedValue({
        timezone: 'UTC',
        name: 'Test Org',
        website: null,
        country: 'Canada',
        industry: 'Tech',
      });
      mockPrisma.branch.findUnique.mockResolvedValue({
        orgId: 'org-1',
        id: 'branch-1',
        timezone: 'UTC',
      });
      mockPrisma.service.findFirst.mockResolvedValue(serviceConfig);
      mockPrisma.appointment.create.mockResolvedValue({
        id: 'appt-new',
        orgId: 'org-1',
        branchId: 'branch-1',
        serviceId: 'svc-1',
        subServiceId: null,
        scheduledAt: new Date(futureDate),
        durationMinutes: 30,
        status: 'confirmed',
      });

      const res = await service.book({
        ...validPayload,
        transactionalSmsAllowed: true,
      });

      expect(res).toEqual(
        expect.objectContaining({
          id: 'appt-new',
          warning:
            'Organization profile (website, country, industry) must be complete to send SMS.',
        }),
      );
      expect(mockNotifications.notifyAppointmentBooked).not.toHaveBeenCalled();
    });

    it('defaults transactional SMS consent to false when booking payload omits it', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-04-20T00:00:00.000Z'));

      mockPrisma.branch.findUnique.mockResolvedValue({
        orgId: 'org-1',
        id: 'branch-1',
        timezone: 'UTC',
      });
      mockPrisma.service.findFirst.mockResolvedValue(serviceConfig);
      mockPrisma.appointment.create.mockResolvedValue({
        id: 'appt-new',
        orgId: 'org-1',
        branchId: 'branch-1',
        serviceId: 'svc-1',
        subServiceId: null,
        scheduledAt: new Date(futureDate),
        durationMinutes: 30,
        status: 'confirmed',
      });
      mockPrisma.customer.findFirst.mockResolvedValue(null);
      mockPrisma.customer.create.mockResolvedValue({ id: 'cust-new' });

      await service.book({ ...validPayload });

      expect(mockPrisma.customer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          transactionalSmsAllowed: false,
        }),
      });
    });

    it('throws NotFoundException when branch not found', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue(null);

      await expect(service.book(validPayload)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when service not found', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue({
        orgId: 'org-1',
        id: 'branch-1',
        timezone: 'UTC',
      });
      mockPrisma.service.findFirst.mockResolvedValue(null);

      await expect(service.book(validPayload)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the service is not assigned to the branch', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue({
        orgId: 'org-1',
        id: 'branch-1',
        timezone: 'UTC',
      });
      mockPrisma.service.findFirst.mockResolvedValue(serviceConfig);
      mockPrisma.branchService.findUnique.mockResolvedValue(null);

      await expect(service.book(validPayload)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.appointment.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the branch service assignment is inactive', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue({
        orgId: 'org-1',
        id: 'branch-1',
        timezone: 'UTC',
      });
      mockPrisma.service.findFirst.mockResolvedValue(serviceConfig);
      mockPrisma.branchService.findUnique.mockResolvedValue({
        isActive: false,
        customServiceEstimateLowMinutes: null,
        customServiceEstimateHighMinutes: null,
      });

      await expect(service.book(validPayload)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.appointment.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for past scheduledAt', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue({
        orgId: 'org-1',
        id: 'branch-1',
        timezone: 'UTC',
      });
      mockPrisma.service.findFirst.mockResolvedValue(serviceConfig);

      const pastDate = new Date(Date.now() - 86400 * 1000).toISOString();

      await expect(service.book({ ...validPayload, scheduledAt: pastDate })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('accepts a UTC slot that falls inside branch working hours in the branch timezone', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-04-20T00:00:00.000Z'));

      mockPrisma.branch.findUnique.mockResolvedValue({
        orgId: 'org-1',
        id: 'branch-1',
        timezone: 'Asia/Dubai',
        name: 'Dubai Branch',
        address: null,
        phone: null,
      });
      mockPrisma.service.findFirst.mockResolvedValue(serviceConfig);

      const created = {
        id: 'appt-dubai',
        orgId: 'org-1',
        branchId: 'branch-1',
        serviceId: 'svc-1',
        subServiceId: null,
        scheduledAt: new Date('2026-04-24T06:00:00.000Z'),
        durationMinutes: 30,
        status: 'confirmed',
      };
      mockPrisma.appointment.create.mockResolvedValue(created);

      await expect(
        service.book({
          ...validPayload,
          scheduledAt: '2026-04-24T06:00:00.000Z',
        }),
      ).resolves.toEqual(created);
    });

    it('falls back to UTC when a legacy branch has an empty timezone', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-04-20T00:00:00.000Z'));

      mockPrisma.branch.findUnique.mockResolvedValue({
        orgId: 'org-1',
        id: 'branch-1',
        timezone: '',
        name: 'Legacy Branch',
        address: null,
        phone: null,
      });
      mockPrisma.service.findFirst.mockResolvedValue(serviceConfig);

      const created = {
        id: 'appt-legacy',
        orgId: 'org-1',
        branchId: 'branch-1',
        serviceId: 'svc-1',
        subServiceId: null,
        scheduledAt: new Date(futureDate),
        durationMinutes: 30,
        status: 'confirmed',
      };
      mockPrisma.appointment.create.mockResolvedValue(created);

      await expect(service.book(validPayload)).resolves.toEqual(created);
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates an appointment', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue({ id: 'appt-1', status: 'pending' });
      mockPrisma.appointment.update.mockResolvedValue({ id: 'appt-1', status: 'confirmed' });

      const result = await service.update('org-1', 'appt-1', 'user-1', { status: 'confirmed' });

      expect(result.status).toBe('confirmed');
    });

    it('allows reverting a confirmed appointment back to pending', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue({
        id: 'appt-1',
        status: 'confirmed',
        assignedUserId: null,
        notes: null,
      });
      mockPrisma.appointment.update.mockResolvedValue({
        id: 'appt-1',
        status: 'pending',
        assignedUserId: null,
        notes: null,
      });

      const result = await service.update('org-1', 'appt-1', 'user-1', { status: 'pending' });

      expect(result.status).toBe('pending');
    });

    it('rejects invalid appointment status transitions', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue({
        id: 'appt-1',
        status: 'completed',
        assignedUserId: null,
        notes: null,
      });

      await expect(
        service.update('org-1', 'appt-1', 'user-1', { status: 'cancelled' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.appointment.update).not.toHaveBeenCalled();
    });
  });

  // ── getAvailableSlots ────────────────────────────────────────────────────

  describe('getAvailableSlots', () => {
    const activeBranchService = {
      isActive: true,
      customServiceEstimateLowMinutes: null as number | null,
      customServiceEstimateHighMinutes: null as number | null,
    };

    it('throws BadRequestException when the service is not assigned to the branch', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue({ orgId: 'org-1', timezone: 'UTC' });
      mockPrisma.service.findFirst.mockResolvedValue({
        id: 'svc-1',
        name: 'Consultation',
        durationMinutes: 30,
        appointmentEnabled: true,
        appointmentSlotInterval: 30,
        appointmentLeadTimeMinutes: 0,
        appointmentMaxAdvanceDays: 30,
        appointmentBufferMinutes: 0,
        appointmentRequiresEmail: false,
      });
      mockPrisma.branchService.findUnique.mockResolvedValue(null);

      await expect(service.getAvailableSlots('branch-1', 'svc-1', '2026-04-23')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns same-day slots instead of throwing when some future times are still available', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-04-23T10:00:00.000Z'));

      mockPrisma.branch.findUnique.mockResolvedValue({ orgId: 'org-1', timezone: 'UTC' });
      mockPrisma.service.findFirst.mockResolvedValue({
        id: 'svc-1',
        name: 'Consultation',
        durationMinutes: 30,
        appointmentEnabled: true,
        appointmentSlotInterval: 30,
        appointmentLeadTimeMinutes: 0,
        appointmentMaxAdvanceDays: 30,
        appointmentBufferMinutes: 0,
        appointmentRequiresEmail: false,
      });
      mockPrisma.branchService.findUnique.mockResolvedValue(activeBranchService);
      mockPrisma.branchDateOverride.findUnique.mockResolvedValue(null);
      mockPrisma.workingHours.findUnique.mockResolvedValue({
        openTime: '09:00',
        closeTime: '17:00',
        isClosed: false,
        breakStart: null,
        breakEnd: null,
      });
      mockPrisma.appointment.findMany.mockResolvedValue([]);

      const slots = await service.getAvailableSlots('branch-1', 'svc-1', '2026-04-23');

      expect(slots.length).toBeGreaterThan(0);
      expect(new Date(slots[0]).getTime()).toBeGreaterThanOrEqual(
        new Date('2026-04-23T10:00:00.000Z').getTime(),
      );
    });

    it('builds slots from branch-local opening hours instead of server timezone', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-04-22T00:00:00.000Z'));

      mockPrisma.branch.findUnique.mockResolvedValue({ orgId: 'org-1', timezone: 'Asia/Dubai' });
      mockPrisma.service.findFirst.mockResolvedValue({
        id: 'svc-1',
        name: 'Consultation',
        durationMinutes: 30,
        appointmentEnabled: true,
        appointmentSlotInterval: 30,
        appointmentLeadTimeMinutes: 0,
        appointmentMaxAdvanceDays: 30,
        appointmentBufferMinutes: 0,
        appointmentRequiresEmail: false,
      });
      mockPrisma.branchService.findUnique.mockResolvedValue(activeBranchService);
      mockPrisma.branchDateOverride.findUnique.mockResolvedValue(null);
      mockPrisma.workingHours.findUnique.mockResolvedValue({
        openTime: '08:00',
        closeTime: '09:00',
        isClosed: false,
        breakStart: null,
        breakEnd: null,
      });
      mockPrisma.appointment.findMany.mockResolvedValue([]);

      const slots = await service.getAvailableSlots('branch-1', 'svc-1', '2026-04-23');

      expect(slots).toEqual(['2026-04-23T04:00:00.000Z', '2026-04-23T04:30:00.000Z']);
    });

    it('falls back to UTC when generating slots for a branch with an empty timezone', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-04-22T00:00:00.000Z'));

      mockPrisma.branch.findUnique.mockResolvedValue({ orgId: 'org-1', timezone: '' });
      mockPrisma.service.findFirst.mockResolvedValue({
        id: 'svc-1',
        name: 'Consultation',
        durationMinutes: 30,
        appointmentEnabled: true,
        appointmentSlotInterval: 30,
        appointmentLeadTimeMinutes: 0,
        appointmentMaxAdvanceDays: 30,
        appointmentBufferMinutes: 0,
        appointmentRequiresEmail: false,
      });
      mockPrisma.branchService.findUnique.mockResolvedValue(activeBranchService);
      mockPrisma.branchDateOverride.findUnique.mockResolvedValue(null);
      mockPrisma.workingHours.findUnique.mockResolvedValue({
        openTime: '08:00',
        closeTime: '09:00',
        isClosed: false,
        breakStart: null,
        breakEnd: null,
      });
      mockPrisma.appointment.findMany.mockResolvedValue([]);

      const slots = await service.getAvailableSlots('branch-1', 'svc-1', '2026-04-23');

      expect(slots).toEqual(['2026-04-23T08:00:00.000Z', '2026-04-23T08:30:00.000Z']);
    });
  });

  // ── delete ────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('deletes an appointment', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue({
        id: 'appt-1',
        branchId: 'branch-1',
        serviceId: 'svc-1',
        status: 'confirmed',
        scheduledAt: new Date(),
      });
      mockPrisma.appointment.delete.mockResolvedValue(undefined);

      await expect(service.delete('org-1', 'appt-1', 'user-1')).resolves.toBeUndefined();
    });
  });

  describe('getPublicById', () => {
    it('returns branch.timezone so the tracking page can render time in the branch locale', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-pub-1',
        orgId: 'org-1',
        branchId: 'branch-1',
        status: 'confirmed',
        scheduledAt: new Date('2026-04-29T07:00:00.000Z'),
        durationMinutes: 45,
        customerName: 'Test User',
        customerEmail: 'test@example.com',
        customerPhone: '+1234567890',
        notes: 'some note',
        branch: {
          id: 'branch-1',
          name: 'Main Branch',
          address: 'Kingsway',
          phone: null,
          timezone: 'America/Toronto',
        },
        service: { id: 'svc-1', name: 'Cutting', durationMinutes: 45 },
        subService: null,
      });
      mockPrisma.ticket.count.mockImplementation(async (args: { where: { status: unknown } }) => {
        if (args.where.status === 'waiting') return 5;
        return 2;
      });
      mockPrisma.appointment.count.mockResolvedValue(3);
      mockPrisma.organization.findUnique.mockResolvedValue({
        name: 'Test Org',
        logoUrl: 'https://example.com/logo.png',
      });

      const result = await service.getPublicById('appt-pub-1');

      // PII must be stripped
      expect(result).not.toHaveProperty('customerEmail');
      expect(result).not.toHaveProperty('customerPhone');
      expect(result).not.toHaveProperty('notes');

      // Presence flags must be set
      expect(result.hasEmail).toBe(true);
      expect(result.hasPhone).toBe(true);

      // branch.timezone must be included for correct time display
      expect(result.branch).toHaveProperty('timezone', 'America/Toronto');

      expect(result.organization).toEqual({
        name: 'Test Org',
        logoUrl: 'https://example.com/logo.png',
      });

      expect(result.liveMetrics).toEqual(
        expect.objectContaining({
          queuePosition: 4,
          waitingCount: 5,
          inRoomCount: 2,
          estimatedMinutes: 360,
        }),
      );
    });

    it('throws NotFoundException when appointment does not exist', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue(null);
      await expect(service.getPublicById('missing-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('customerLookup', () => {
    it('scopes lookup to the branch org and branch id', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue({ orgId: 'org-1' });
      mockPrisma.appointment.findMany.mockResolvedValue([
        {
          id: 'appt-1',
          status: 'pending',
          scheduledAt: new Date('2026-05-01T10:00:00.000Z'),
          durationMinutes: 30,
          customerName: 'Alice',
          service: { id: 'svc-1', name: 'Consultation' },
          branch: { id: 'branch-1', name: 'Main', timezone: 'UTC' },
          subService: null,
        },
      ]);

      const result = await service.customerLookup('branch-1', 'test@example.com');

      expect(result).toEqual([
        expect.objectContaining({
          id: 'appt-1',
          customerNameMasked: 'A***e',
        }),
      ]);
      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orgId: 'org-1',
            branchId: 'branch-1',
            customerEmail: 'test@example.com',
          }),
        }),
      );
    });

    it('throws when branch does not exist', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue(null);
      await expect(
        service.customerLookup('missing-branch', undefined, '+15551230000'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('sendDueReminders', () => {
    it('queues reminder once and stores dedupe key', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-01T10:00:00.000Z'));
      mockConfig.get.mockImplementation((key: string, fallback?: string) => {
        if (key === 'APPOINTMENT_REMINDER_MINUTES') return '60';
        if (key === 'APPOINTMENT_REMINDER_SCAN_WINDOW_MINUTES') return '15';
        return fallback;
      });
      mockPrisma.appointment.findMany.mockResolvedValue([
        {
          id: 'appt-1',
          orgId: 'org-1',
          customerName: 'Alice',
          customerPhone: '+15551230000',
          customerEmail: 'alice@example.com',
          scheduledAt: new Date('2026-05-01T11:05:00.000Z'),
          branch: { name: 'Main' },
          service: { name: 'Consultation' },
        },
      ]);
      mockRedis.get.mockResolvedValue(null);

      const sent = await service.sendDueReminders();

      expect(sent).toBe(1);
      expect(mockNotifications.notifyAppointmentReminder).toHaveBeenCalledTimes(1);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'notification:appointment:appt-1:reminder:60',
        'sent',
        14 * 24 * 60 * 60,
      );
    });
  });

  describe('getAnalyticsSummary', () => {
    it('aggregates appointments by status, branch, and service', async () => {
      const orgId = 'org-1';
      const opts = { dateFrom: '2026-05-01', dateTo: '2026-05-01' };

      mockPrisma.appointment.count.mockResolvedValue(10);
      mockPrisma.appointment.groupBy.mockImplementation(async (args: any) => {
        if (args.by.includes('status')) {
          return [
            { status: 'confirmed', _count: { _all: 7 } },
            { status: 'completed', _count: { _all: 3 } },
          ];
        }
        if (args.by.includes('branchId')) {
          return [{ branchId: 'b1', _count: { _all: 10 } }];
        }
        if (args.by.includes('serviceId')) {
          return [{ serviceId: 's1', _count: { _all: 10 } }];
        }
        return [];
      });

      mockPrisma.branch.findMany.mockResolvedValue([{ id: 'b1', name: 'Branch 1' }]);
      mockPrisma.service.findMany.mockResolvedValue([{ id: 's1', name: 'Service 1' }]);

      const result = await service.getAnalyticsSummary(orgId, opts);

      expect(result.total).toBe(10);
      expect(result.byStatus).toEqual([
        { status: 'confirmed', count: 7 },
        { status: 'completed', count: 3 },
      ]);
      expect(result.byBranch).toEqual([{ branchId: 'b1', branchName: 'Branch 1', count: 10 }]);
      expect(result.byService).toEqual([{ serviceId: 's1', serviceName: 'Service 1', count: 10 }]);
    });

    it('returns zero counts when no appointments match', async () => {
      const orgId = 'org-1';
      const opts = { dateFrom: '2026-05-01', dateTo: '2026-05-01' };

      mockPrisma.appointment.count.mockResolvedValue(0);
      mockPrisma.appointment.groupBy.mockResolvedValue([]);

      const result = await service.getAnalyticsSummary(orgId, opts);

      expect(result.total).toBe(0);
      expect(result.byStatus).toEqual([]);
      expect(result.byBranch).toEqual([]);
      expect(result.byService).toEqual([]);
    });
  });
});
