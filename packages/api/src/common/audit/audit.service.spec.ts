import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  const activityLogCreate = vi.fn().mockResolvedValue({});
  const auditLogCreate = vi.fn().mockResolvedValue({});
  const prisma = {
    withTenant: vi.fn((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        activityLog: { create: activityLogCreate },
        auditLog: { create: auditLogCreate },
      }),
    ),
  };
  const requestContext = {
    getContext: vi.fn().mockReturnValue({
      requestId: 'req-1',
      ip: '127.0.0.1',
      userAgent: 'test',
      userId: 'cls-user',
    }),
    getRequestId: vi.fn().mockReturnValue('req-1'),
    getUserId: vi.fn().mockReturnValue('cls-user'),
  };
  const config = { get: vi.fn().mockReturnValue(undefined) };

  let service: AuditService;

  beforeEach(() => {
    activityLogCreate.mockClear();
    auditLogCreate.mockClear();
    requestContext.getUserId.mockReturnValue('cls-user');
    service = new AuditService(prisma as any, requestContext as any, config as any);
  });

  it('logActivity uses explicit userId over CLS', async () => {
    await service.logActivity({
      orgId: 'org-1',
      action: 'loyalty.points.adjusted',
      resourceType: 'loyalty_account',
      userId: 'explicit-user',
    });
    expect(activityLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'explicit-user' }),
      }),
    );
  });

  it('logActivity falls back to RequestContext userId', async () => {
    await service.logActivity({
      orgId: 'org-1',
      action: 'loyalty.points.adjusted',
      resourceType: 'loyalty_account',
    });
    expect(activityLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'cls-user' }),
      }),
    );
  });

  it('logAudit falls back to RequestContext userId', async () => {
    await service.logAudit({
      orgId: 'org-1',
      action: 'update',
      tableName: 'customers',
      recordId: '00000000-0000-0000-0000-000000000001',
    });
    expect(auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'cls-user' }),
      }),
    );
  });
});
