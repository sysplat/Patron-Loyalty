import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnnouncementService } from './announcement.service';

/**
 * Display-scoped announcements must never leak org-wide rows from other tenants.
 */
describe('AnnouncementService — display listActive', () => {
  const mockPrisma = {
    withBypassRls: vi.fn(async (cb) => cb(mockPrisma)),
    withTenant: vi.fn(async (orgId, cb) => cb(mockPrisma)),
    announcement: { findMany: vi.fn() },
  };

  const mockRealtime = { publish: vi.fn().mockResolvedValue(undefined) };
  const mockPlatformAudit = { log: vi.fn() };

  let service: AnnouncementService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AnnouncementService(
      mockPrisma as any,
      mockRealtime as any,
      mockPlatformAudit as any,
    );
  });

  it('scopes active display announcements to orgId and branch', async () => {
    const active = [{ id: 'ann-1', orgId: 'org-1', branchId: 'branch-1', displayOnScreen: true }];
    mockPrisma.announcement.findMany.mockResolvedValue(active);

    const result = await service.listActive('org-1', 'branch-1');

    expect(result).toEqual(active);
    const callArg = mockPrisma.announcement.findMany.mock.calls[0][0];
    expect(callArg.where.orgId).toBe('org-1');
    expect(callArg.where.displayOnScreen).toBe(true);
    expect(callArg.where.AND).toEqual(
      expect.arrayContaining([{ OR: [{ branchId: 'branch-1' }, { branchId: null }] }]),
    );
  });

  it('does not query without orgId (prevents cross-tenant org-wide rows)', async () => {
    mockPrisma.announcement.findMany.mockResolvedValue([]);

    await service.listActive('org-a', 'branch-x');

    const callArg = mockPrisma.announcement.findMany.mock.calls[0][0];
    expect(callArg.where.orgId).toBe('org-a');
    expect(callArg.where).not.toEqual(expect.objectContaining({ orgId: undefined }));
  });
});
