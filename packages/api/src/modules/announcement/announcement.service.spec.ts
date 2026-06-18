import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnnouncementService } from './announcement.service';
import { NotFoundException } from '@nestjs/common';
import { attachTenantIsolationMocks } from '../../test/mock-prisma-tenant';

// ─── Prisma mock ─────────────────────────────────────────────────────────────

const mockPrisma = {
  withBypassRls: vi.fn(async (cb) => cb(mockPrisma)),
  withTenant: vi.fn(async (orgId, cb) => cb(mockPrisma)),
  announcement: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  platformAnnouncement: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  announcementUserState: {
    findMany: vi.fn(),
    upsert: vi.fn(),
    count: vi.fn(),
  },
};

const mockRealtime = {
  publish: vi.fn().mockResolvedValue(undefined),
};

const mockPlatformAudit = {
  log: vi.fn().mockResolvedValue(undefined),
};

describe('AnnouncementService', () => {
  let service: AnnouncementService;

  beforeEach(() => {
    vi.clearAllMocks();
    attachTenantIsolationMocks(mockPrisma);
    service = new AnnouncementService(
      mockPrisma as any,
      mockRealtime as any,
      mockPlatformAudit as any,
    );
  });

  // ── list ──────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('returns announcements for an org', async () => {
      const announcements = [{ id: 'ann-1', orgId: 'org-1' }];
      mockPrisma.announcement.findMany.mockResolvedValue(announcements);

      const result = await service.list('org-1');

      expect(result).toEqual(announcements);
      expect(mockPrisma.announcement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ orgId: 'org-1' }),
        }),
      );
    });

    it('applies branch filter when branchId provided', async () => {
      mockPrisma.announcement.findMany.mockResolvedValue([]);

      await service.list('org-1', 'branch-1');

      const call = mockPrisma.announcement.findMany.mock.calls[0][0];
      // Should include OR for branch filter
      expect(JSON.stringify(call.where)).toContain('branch-1');
    });
  });

  // ── getById ───────────────────────────────────────────────────────────────

  describe('getById', () => {
    it('returns announcement when found', async () => {
      const ann = { id: 'ann-1' };
      mockPrisma.announcement.findFirst.mockResolvedValue(ann);

      expect(await service.getById('org-1', 'ann-1')).toEqual(ann);
    });

    it('throws NotFoundException for unknown id', async () => {
      mockPrisma.announcement.findFirst.mockResolvedValue(null);

      await expect(service.getById('org-1', 'unknown')).rejects.toThrow(NotFoundException);
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates an announcement with defaults', async () => {
      const created = { id: 'ann-new', type: 'info', displayOnScreen: true };
      mockPrisma.announcement.create.mockResolvedValue(created);

      const result = await service.create('org-1', { message: 'Hello!' });

      expect(result).toEqual(created);
      const data = mockPrisma.announcement.create.mock.calls[0][0].data;
      expect(data.type).toBe('info');
      expect(data.displayOnScreen).toBe(true);
      expect(data.activeFrom).toBeNull();
      expect(data.activeUntil).toBeNull();
    });

    it('parses date strings to Date objects', async () => {
      mockPrisma.announcement.create.mockResolvedValue({ id: 'ann-1' });

      await service.create('org-1', {
        message: 'Sale!',
        activeFrom: '2026-04-01',
        activeUntil: '2026-04-30',
      });

      const data = mockPrisma.announcement.create.mock.calls[0][0].data;
      expect(data.activeFrom).toBeInstanceOf(Date);
      expect(data.activeUntil).toBeInstanceOf(Date);
    });

    it('publishes announcement.changed to org and display when branch-scoped', async () => {
      mockPrisma.announcement.create.mockResolvedValue({
        id: 'ann-branch',
        branchId: 'branch-42',
      });

      await service.create('org-1', { message: 'Hi', branchId: 'branch-42' });

      expect(mockRealtime.publish).toHaveBeenCalledWith(`org:org-1`, {
        event: 'announcement.changed',
        data: { orgId: 'org-1', branchId: 'branch-42' },
      });
      expect(mockRealtime.publish).toHaveBeenCalledWith(`display:branch-42`, {
        event: 'announcement.changed',
        data: { orgId: 'org-1', branchId: 'branch-42' },
      });
    });

    it('publishes announcement.changed to org only for organization-wide announcements', async () => {
      mockPrisma.announcement.create.mockResolvedValue({
        id: 'ann-all',
        branchId: null,
      });

      await service.create('org-1', { message: 'Org wide' });

      expect(mockRealtime.publish).toHaveBeenCalledTimes(1);
      expect(mockRealtime.publish).toHaveBeenCalledWith(`org:org-1`, {
        event: 'announcement.changed',
        data: { orgId: 'org-1', branchId: null },
      });
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates an announcement', async () => {
      mockPrisma.announcement.findFirst.mockResolvedValue({ id: 'ann-1' });
      mockPrisma.announcement.update.mockResolvedValue({ id: 'ann-1', message: 'Updated' });

      const result = await service.update('org-1', 'ann-1', { message: 'Updated' });

      expect(result.message).toBe('Updated');
    });

    it('sets active dates to null when null strings passed', async () => {
      mockPrisma.announcement.findFirst.mockResolvedValue({ id: 'ann-1' });
      mockPrisma.announcement.update.mockResolvedValue({ id: 'ann-1' });

      await service.update('org-1', 'ann-1', { activeFrom: null, activeUntil: null });

      const data = mockPrisma.announcement.update.mock.calls[0][0].data;
      expect(data.activeFrom).toBeNull();
      expect(data.activeUntil).toBeNull();
    });
  });

  // ── delete ────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('deletes an announcement', async () => {
      mockPrisma.announcement.findFirst.mockResolvedValue({ id: 'ann-1' });
      mockPrisma.announcement.delete.mockResolvedValue(undefined);

      await expect(service.delete('org-1', 'ann-1')).resolves.toBeUndefined();
    });
  });

  describe('unified feed + actions', () => {
    it('returns merged platform + org feed rows', async () => {
      mockPrisma.platformAnnouncement.findMany.mockResolvedValue([
        {
          id: 'p1',
          title: 'Platform incident',
          body: 'Investigating',
          type: 'critical',
          deliveryMode: 'banner',
          dismissBehavior: 'disallowed',
          requireAcknowledgment: true,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          isActive: true,
        },
      ]);
      vi.spyOn(service, 'listForPrincipal').mockResolvedValue([
        {
          id: 'o1',
          orgId: 'org-1',
          branchId: null,
          message: 'Org message',
          type: 'info',
          deliveryMode: 'banner',
          dismissBehavior: 'allowed',
          requireAcknowledgment: false,
          displayOnScreen: true,
          activeFrom: null,
          activeUntil: null,
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
          updatedAt: new Date('2026-01-02T00:00:00.000Z'),
          branch: null,
        },
      ]);
      mockPrisma.announcementUserState.findMany.mockResolvedValue([]);

      const result = await service.getUnifiedFeedForPrincipal('org-1', 'user-1');
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('sourceType');
      expect(result[0]).toHaveProperty('policy');
      expect(mockPrisma.announcementUserState.findMany).toHaveBeenCalled();
    });

    it('blocks dismiss when acknowledgment is required', async () => {
      mockPrisma.platformAnnouncement.findUnique.mockResolvedValue({
        id: 'p1',
        isActive: true,
        dismissBehavior: 'disallowed',
        requireAcknowledgment: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      });

      await expect(
        service.dismissForPrincipal('org-1', 'user-1', 'platform', 'p1'),
      ).rejects.toThrow();
    });
  });
});
