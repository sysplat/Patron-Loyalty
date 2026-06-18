import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SupportService } from './support.service';

const mockPrisma = {
  withBypassRls: vi.fn(async (cb) => cb(mockPrisma)),
  withTenant: vi.fn(async (_orgId, cb) => cb(mockPrisma)),
  supportRequest: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  supportMessage: {
    create: vi.fn(),
  },
  roleAssignment: {
    findMany: vi.fn(),
  },
  subscription: { findFirst: vi.fn() },
  branch: { count: vi.fn() },
  user: { count: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
  activityLog: { findMany: vi.fn() },
};

const mockEventEmitter = {
  emitAsync: vi.fn().mockResolvedValue(undefined),
};

const mockAudit = {
  logActivity: vi.fn().mockResolvedValue(undefined),
  logAudit: vi.fn().mockResolvedValue(undefined),
};

describe('SupportService', () => {
  let service: SupportService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.roleAssignment.findMany.mockResolvedValue([]);
    service = new SupportService(
      mockPrisma as never,
      mockEventEmitter as never,
      mockAudit as never,
    );
  });

  it('creates a persistent support request with contact set to submitter', async () => {
    mockPrisma.supportRequest.create.mockResolvedValue({
      id: 'sr-1',
      orgId: 'org-xyz',
      organization: { id: 'org-xyz', name: 'Acme', slug: 'acme', timezone: 'UTC' },
      createdBy: { id: 'u1', email: 'actor@biz.com', firstName: 'A', lastName: 'B' },
      contact: { id: 'u1', email: 'actor@biz.com', firstName: 'A', lastName: 'B' },
      assignedTo: null,
      messages: [],
    });

    await service.submit(
      'org-xyz',
      { userId: 'u1', email: 'actor@biz.com', firstName: 'A', lastName: 'B' },
      { subject: 'Need help', message: 'Details here', priority: 'high', category: 'billing' },
    );

    expect(mockPrisma.supportRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdByUserId: 'u1',
          contactUserId: 'u1',
        }),
      }),
    );
    expect(mockEventEmitter.emitAsync).toHaveBeenCalled();
    expect(mockAudit.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'support.request.submit',
        orgId: 'org-xyz',
        userId: 'u1',
        resourceId: 'sr-1',
      }),
    );
  });

  it('rejects invalid or empty submit payloads', async () => {
    await expect(
      service.submit(
        'org-xyz',
        { userId: 'u1', email: 'a@b.com' },
        { subject: 'x', message: '', priority: 'normal' },
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.submit(
        'org-xyz',
        { userId: 'u1', email: 'a@b.com' },
        { subject: 'x', message: 'ok', priority: 'urgent' as never },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('only the assigned contact can send a public reply to QlessQ', async () => {
    mockPrisma.supportRequest.findFirst.mockResolvedValue({
      id: 'sr-1',
      status: 'open',
      createdByUserId: 'u1',
      contactUserId: 'u1',
    });

    await expect(
      service.addOrgReply('org-xyz', { userId: 'u2' }, 'sr-1', { message: 'Hello support' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows org internal notes without notifying platform', async () => {
    mockPrisma.roleAssignment.findMany.mockResolvedValue([
      { role: { isSystemRole: true, name: 'manager' } },
    ]);
    mockPrisma.supportRequest.findFirst.mockResolvedValue({
      id: 'sr-1',
      status: 'open',
      createdByUserId: 'u1',
      contactUserId: 'u1',
    });
    mockPrisma.supportMessage.create.mockResolvedValue({
      id: 'msg-1',
      body: 'FYI for the team',
      isInternal: false,
      isOrgInternal: true,
      createdAt: new Date(),
      author: {
        id: 'u2',
        email: 'admin@biz.com',
        firstName: 'Admin',
        lastName: 'User',
        organization: { slug: 'acme' },
      },
    });

    await service.addOrgReply('org-xyz', { userId: 'u2' }, 'sr-1', {
      message: 'FYI for the team',
      isOrgInternal: true,
    });

    expect(mockPrisma.supportRequest.update).not.toHaveBeenCalled();
    expect(mockEventEmitter.emitAsync).not.toHaveBeenCalled();
  });

  it('updates platform-side support status and writes audit trail', async () => {
    mockPrisma.supportRequest.findUnique.mockResolvedValue({
      id: 'sr-1',
      orgId: 'org-xyz',
      status: 'open',
    });
    mockPrisma.supportRequest.update.mockResolvedValue({
      id: 'sr-1',
      orgId: 'org-xyz',
      status: 'resolved',
      organization: null,
      createdBy: null,
      contact: null,
      assignedTo: null,
      messages: [],
    });

    await service.updatePlatformRequest({ userId: 'platform-op' }, 'sr-1', { status: 'resolved' });

    expect(mockPrisma.supportRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sr-1' },
        data: expect.objectContaining({ status: 'resolved' }),
      }),
    );
    expect(mockAudit.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'support.request.update' }),
    );
  });

  it('sets hasUnreadPlatformReply to true when resolving a ticket', async () => {
    mockPrisma.supportRequest.findUnique.mockResolvedValue({
      id: 'sr-1',
      orgId: 'org-xyz',
      status: 'open',
    });
    mockPrisma.supportRequest.update.mockClear();
    mockPrisma.supportRequest.update.mockResolvedValue({
      id: 'sr-1',
      orgId: 'org-xyz',
      status: 'resolved',
    });

    await service.updatePlatformRequest({ userId: 'platform-op' }, 'sr-1', { status: 'resolved' });

    expect(mockPrisma.supportRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'resolved',
          hasUnreadPlatformReply: true,
        }),
      }),
    );
  });

  it('validates assignee is a platform operator', async () => {
    mockPrisma.supportRequest.findUnique.mockResolvedValue({
      id: 'sr-1',
      orgId: 'org-xyz',
      status: 'open',
    });
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'u-random',
      email: 'random@customer.com',
      organization: { slug: 'customer-org' },
    });

    await expect(
      service.updatePlatformRequest({ userId: 'platform-op' }, 'sr-1', {
        assignedToUserId: 'u-random',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('reassigns org contact for owner/admin', async () => {
    mockPrisma.roleAssignment.findMany.mockResolvedValue([
      { role: { isSystemRole: true, name: 'owner' } },
    ]);
    mockPrisma.supportRequest.findFirst.mockResolvedValue({
      id: 'sr-1',
      contactUserId: 'u1',
    });
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'u2',
      email: 'billing@biz.com',
      firstName: 'Bill',
      lastName: 'Ing',
    });
    mockPrisma.supportRequest.update.mockResolvedValue({});

    const contact = await service.reassignContact('org-xyz', { userId: 'admin-1' }, 'sr-1', 'u2');

    expect(contact.id).toBe('u2');
    expect(mockPrisma.supportRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { contactUserId: 'u2' },
      }),
    );
  });
});
