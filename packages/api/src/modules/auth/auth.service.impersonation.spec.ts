import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { INTERNAL_PLATFORM_ORG_SLUG } from '@queueplatform/shared';
import { AuthService } from './auth.service';

const mockPrisma = {
  withTenant: vi.fn(async (_orgId, cb) => cb(mockPrisma)),
  user: { findUnique: vi.fn() },
  organization: { findUnique: vi.fn() },
  branch: { findFirst: vi.fn() },
  withBypassRls: vi.fn().mockImplementation((callback) => callback(mockPrisma)),
};

const mockJwtService = { sign: vi.fn().mockReturnValue('impersonation-jwt') };
const mockConfigService = { get: vi.fn().mockReturnValue(900) };
const mockNotificationService = {};
const mockRequestContext = {};
const mockPlatformAudit = { log: vi.fn().mockResolvedValue(undefined) };
const mockAudit = {};

describe('AuthService impersonation', () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(
      mockPrisma as never,
      mockJwtService as never,
      mockConfigService as never,
      mockNotificationService as never,
      mockRequestContext as never,
      mockPlatformAudit as never,
      mockAudit as never,
      {} as never, // redis
    );
  });

  it('rejects non-platform operators', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-tenant',
      email: 'agent@tenant.com',
      orgId: 'org-tenant',
      organization: { slug: 'acme-clinic' },
    });

    await expect(
      service.startImpersonation(
        { userId: 'user-tenant', email: 'agent@tenant.com' },
        'org-target',
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(mockJwtService.sign).not.toHaveBeenCalled();
  });

  it('issues full-access impersonation JWT for internal platform operators', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'op-1',
      email: 'ops@queueplatform.internal',
      orgId: 'org-platform',
      organization: { slug: INTERNAL_PLATFORM_ORG_SLUG },
    });
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: 'org-target',
      name: 'Acme Clinic',
      slug: 'acme-clinic',
    });

    const result = await service.startImpersonation(
      { userId: 'op-1', email: 'ops@queueplatform.internal' },
      'org-target',
    );

    expect(result.accessToken).toBe('impersonation-jwt');
    expect(result.expiresIn).toBe(900);
    expect(result.targetOrganization).toEqual({
      id: 'org-target',
      name: 'Acme Clinic',
      slug: 'acme-clinic',
    });
    expect(result.simulation).toBeUndefined();
    expect(mockPlatformAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'platform.impersonation.start' }),
    );
    expect(mockJwtService.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'op-1',
        imp: true,
        actAsOrgId: 'org-target',
      }),
      { expiresIn: '900s' },
    );
  });

  it('issues role-simulation impersonation JWT with branch scope', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'op-1',
      email: 'ops@queueplatform.internal',
      orgId: 'org-platform',
      organization: { slug: INTERNAL_PLATFORM_ORG_SLUG },
    });
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: 'org-target',
      name: 'Acme Clinic',
      slug: 'acme-clinic',
    });
    mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1', name: 'Main' });

    const result = await service.startImpersonation(
      { userId: 'op-1', email: 'ops@queueplatform.internal' },
      'org-target',
      { role: 'staff', branchId: 'branch-1' },
    );

    expect(result.simulation).toEqual({
      role: 'staff',
      branchId: 'branch-1',
      branchName: 'Main',
    });
    expect(mockJwtService.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        actAsRole: 'staff',
        actAsBranchId: 'branch-1',
      }),
      { expiresIn: '900s' },
    );
  });

  it('rejects impersonation when target org is missing', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'op-1',
      email: 'ops@queueplatform.internal',
      orgId: 'org-platform',
      organization: { slug: INTERNAL_PLATFORM_ORG_SLUG },
    });
    mockPrisma.organization.findUnique.mockResolvedValue(null);

    await expect(
      service.startImpersonation(
        { userId: 'op-1', email: 'ops@queueplatform.internal' },
        'org-missing',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('records impersonation end in platform audit log', async () => {
    await service.endImpersonationAudit(
      { userId: 'op-1', email: 'ops@queueplatform.internal' },
      'org-target',
    );
    expect(mockPlatformAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'platform.impersonation.end',
        subjectOrgId: 'org-target',
      }),
    );
  });
});
