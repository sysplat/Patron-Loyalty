import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrganizationService } from './organization.service';

const mockPrisma = {
  withBypassRls: vi.fn(async (cb) => cb(mockPrisma)),
  withTenant: vi.fn(async (orgId, cb) => cb(mockPrisma)),
  organization: {
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
  },
  role: { findFirst: vi.fn() },
  roleAssignment: { findFirst: vi.fn() },
};

const mockConfig = {
  get: vi.fn((key: string, defaultValue?: unknown) => {
    if (key === 'app.visitJourneysGloballyDisabled') return false;
    if (key === 'app.visitJourneysLegacyGlobalOn') return false;
    return defaultValue;
  }),
};

describe('OrganizationService', () => {
  let service: OrganizationService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.role.findFirst.mockImplementation(({ where }: { where: { name?: string } }) => {
      if (where?.name === 'owner') return Promise.resolve({ id: 'owner-role' });
      if (where?.name === 'admin') return Promise.resolve({ id: 'admin-role' });
      return Promise.resolve(null);
    });
    mockPrisma.roleAssignment.findFirst.mockImplementation(
      ({ where }: { where: { userId?: string; roleId?: string } }) => {
        const uid = where?.userId;
        const rid = where?.roleId;
        if (rid === 'owner-role' && uid === 'owner-user')
          return Promise.resolve({ id: 'ra-owner' });
        if (rid === 'admin-role' && uid === 'admin-user')
          return Promise.resolve({ id: 'ra-admin' });
        return Promise.resolve(null);
      },
    );
    service = new OrganizationService(
      mockPrisma as never,
      {} as any,
      mockConfig as never,
      { requireFeature: vi.fn().mockResolvedValue(undefined) } as never,
    );
  });

  it('allows owner to change organization name', async () => {
    mockPrisma.organization.update.mockResolvedValue({ id: 'org-1', name: 'New Name' });

    await expect(
      service.updateOrganization('org-1', 'owner-user', { name: 'New Name' }),
    ).resolves.toBeDefined();
    expect(mockPrisma.organization.update).toHaveBeenCalled();
  });

  it('forbids non-owner from changing organization name', async () => {
    await expect(
      service.updateOrganization('org-1', 'admin-user', { name: 'Hacked' }),
    ).rejects.toThrow(/Only an organization owner may update organization profile fields/);
    expect(mockPrisma.organization.update).not.toHaveBeenCalled();
  });

  it('forbids non-owner from changing website or other profile fields', async () => {
    await expect(
      service.updateOrganization('org-1', 'admin-user', { website: 'https://evil.example' }),
    ).rejects.toThrow(/Only an organization owner may update organization profile fields/);
    expect(mockPrisma.organization.update).not.toHaveBeenCalled();
  });

  it('forbids non-owner from changing logoUrl', async () => {
    await expect(
      service.updateOrganization('org-1', 'admin-user', {
        logoUrl: 'https://evil.example/logo.png',
      }),
    ).rejects.toThrow(/Only an organization owner may update organization profile fields/);
    expect(mockPrisma.organization.update).not.toHaveBeenCalled();
  });

  it('allows owner to change logoUrl', async () => {
    mockPrisma.organization.update.mockResolvedValue({
      id: 'org-1',
      logoUrl: 'data:image/png;base64,xxx',
    });

    await expect(
      service.updateOrganization('org-1', 'owner-user', { logoUrl: 'data:image/png;base64,xxx' }),
    ).resolves.toBeDefined();
  });

  it('allows owner to update website without changing name or logo', async () => {
    mockPrisma.organization.update.mockResolvedValue({
      id: 'org-1',
      website: 'https://example.com',
    });

    await expect(
      service.updateOrganization('org-1', 'owner-user', { website: 'https://example.com' }),
    ).resolves.toBeDefined();
    expect(mockPrisma.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ website: 'https://example.com' }),
      }),
    );
  });

  it('allows org admin (not owner) to toggle visit journeys only', async () => {
    mockPrisma.organization.update.mockResolvedValue({ id: 'org-1', visitJourneysEnabled: true });

    await expect(
      service.updateOrganization('org-1', 'admin-user', { visitJourneysEnabled: true }),
    ).resolves.toMatchObject({ visitJourneysEnabled: true });
    expect(mockPrisma.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ visitJourneysEnabled: true }),
      }),
    );
  });

  it('forbids manager from toggling visit journeys', async () => {
    mockPrisma.roleAssignment.findFirst.mockResolvedValue(null);

    await expect(
      service.updateOrganization('org-1', 'manager-user', { visitJourneysEnabled: true }),
    ).rejects.toThrow(/Only an organization owner or admin may enable or disable visit journeys/);
    expect(mockPrisma.organization.update).not.toHaveBeenCalled();
  });

  it('requires hasCustomBranding when setting brand colors', async () => {
    const planLimits = { requireFeature: vi.fn().mockRejectedValue(new Error('upgrade')) };
    service = new OrganizationService(
      mockPrisma as never,
      {} as any,
      mockConfig as never,
      planLimits as never,
    );
    await expect(
      service.updateOrganization('org-1', 'owner-user', { brandPrimaryColor: '#112233' }),
    ).rejects.toThrow(/upgrade/);
    expect(planLimits.requireFeature).toHaveBeenCalledWith(
      'org-1',
      'hasCustomBranding',
      expect.any(String),
    );
    expect(mockPrisma.organization.update).not.toHaveBeenCalled();
  });

  it('allows clearing brand colors without feature gate', async () => {
    const planLimits = { requireFeature: vi.fn().mockResolvedValue(undefined) };
    service = new OrganizationService(
      mockPrisma as never,
      {} as any,
      mockConfig as never,
      planLimits as never,
    );
    mockPrisma.organization.update.mockResolvedValue({ id: 'org-1' });
    await service.updateOrganization('org-1', 'owner-user', {
      brandPrimaryColor: '',
      brandAccentColor: null,
    });
    expect(planLimits.requireFeature).not.toHaveBeenCalled();
    expect(mockPrisma.organization.update).toHaveBeenCalled();
  });
});
