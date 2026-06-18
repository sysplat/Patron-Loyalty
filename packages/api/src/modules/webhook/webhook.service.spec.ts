import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { WebhookService } from './webhook.service';

const mockPrisma = {
  withBypassRls: vi.fn(async (cb) => cb(mockPrisma)),
  withTenant: vi.fn(async (orgId, cb) => cb(mockPrisma)),
  webhookEndpoint: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};

const mockRedis = {};

const mockRequestContext = {
  getRequestId: vi.fn(),
};

describe('WebhookService', () => {
  let service: WebhookService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    service = new WebhookService(mockPrisma as any, mockRedis as any, mockRequestContext as any);
  });

  describe('list', () => {
    it('returns active endpoints for the organization', async () => {
      mockPrisma.webhookEndpoint.findMany.mockResolvedValue([{ id: 'ep-1', url: 'https://a.com' }]);
      const res = await service.list('org-1');
      expect(res).toEqual([{ id: 'ep-1', url: 'https://a.com' }]);
      expect(mockPrisma.webhookEndpoint.findMany).toHaveBeenCalledWith({
        where: { orgId: 'org-1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('create', () => {
    it('creates a new webhook endpoint with generated secret', async () => {
      mockPrisma.webhookEndpoint.create.mockResolvedValue({
        id: 'ep-2',
        orgId: 'org-1',
        url: 'https://b.com',
        events: ['ticket.called'],
        secret: 'whsec_dummy',
      });

      const res = await service.create('org-1', {
        url: 'https://b.com',
        events: ['ticket.called'],
      });

      expect(res).toBeDefined();
      expect(mockPrisma.webhookEndpoint.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orgId: 'org-1',
          url: 'https://b.com',
          events: ['ticket.called'],
          secret: expect.stringMatching(/^whsec_/),
          status: 'active',
        }),
      });
    });
  });

  describe('update', () => {
    it('updates an existing endpoint if found', async () => {
      mockPrisma.webhookEndpoint.findFirst.mockResolvedValue({ id: 'ep-1', orgId: 'org-1' });
      mockPrisma.webhookEndpoint.update.mockResolvedValue({ id: 'ep-1', status: 'inactive' });

      const res = await service.update('org-1', 'ep-1', { status: 'inactive' });
      expect(res.status).toBe('inactive');
      expect(mockPrisma.webhookEndpoint.update).toHaveBeenCalledWith({
        where: { id: 'ep-1' },
        data: { status: 'inactive' },
      });
    });

    it('throws NotFoundException if endpoint does not exist', async () => {
      mockPrisma.webhookEndpoint.findFirst.mockResolvedValue(null);
      await expect(service.update('org-1', 'ep-1', { status: 'inactive' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('deletes an existing endpoint if found', async () => {
      mockPrisma.webhookEndpoint.findFirst.mockResolvedValue({ id: 'ep-1', orgId: 'org-1' });
      mockPrisma.webhookEndpoint.delete.mockResolvedValue({ id: 'ep-1' });

      await service.delete('org-1', 'ep-1');
      expect(mockPrisma.webhookEndpoint.delete).toHaveBeenCalledWith({
        where: { id: 'ep-1' },
      });
    });

    it('throws NotFoundException if endpoint does not exist', async () => {
      mockPrisma.webhookEndpoint.findFirst.mockResolvedValue(null);
      await expect(service.delete('org-1', 'ep-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('rotateSecret', () => {
    it('rotates secret of an existing endpoint', async () => {
      mockPrisma.webhookEndpoint.findFirst.mockResolvedValue({ id: 'ep-1', orgId: 'org-1' });
      mockPrisma.webhookEndpoint.update.mockResolvedValue({ id: 'ep-1', secret: 'whsec_new' });

      const res = await service.rotateSecret('org-1', 'ep-1');
      expect(res.secret).toBe('whsec_new');
      expect(mockPrisma.webhookEndpoint.update).toHaveBeenCalledWith({
        where: { id: 'ep-1' },
        data: { secret: expect.stringMatching(/^whsec_/) },
      });
    });
  });

  describe('dispatchEvent', () => {
    let fetchSpy: any;

    beforeEach(() => {
      fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((() =>
        Promise.resolve(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            statusText: 'OK',
          }),
        )) as any);
    });

    it('does nothing if no active endpoints match', async () => {
      mockPrisma.webhookEndpoint.findMany.mockResolvedValue([
        { id: 'ep-1', url: 'https://a.com', events: ['ticket.called'], secret: '123' },
      ]);

      await service.dispatchEvent('org-1', 'ticket.cancelled', { id: 't-1' });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('dispatches matched events and updates lastTriggeredAt', async () => {
      mockPrisma.webhookEndpoint.findMany.mockResolvedValue([
        { id: 'ep-1', url: 'https://a.com', events: ['*'], secret: 'secret123' },
      ]);
      mockRequestContext.getRequestId.mockReturnValue('req-123');

      await service.dispatchEvent('org-1', 'ticket.called', { id: 't-1' });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe('https://a.com');
      expect(options.method).toBe('POST');
      expect(options.headers).toBeDefined();
      expect(options.headers['X-Request-Id']).toBe('req-123');
      expect(options.headers['X-Webhook-Event']).toBe('ticket.called');
      expect(options.headers['X-Webhook-Signature']).toBeDefined();

      expect(mockPrisma.webhookEndpoint.update).toHaveBeenCalledWith({
        where: { id: 'ep-1' },
        data: { lastTriggeredAt: expect.any(Date) },
      });
    });

    it('catches fetch failures and logs them gracefully', async () => {
      mockPrisma.webhookEndpoint.findMany.mockResolvedValue([
        { id: 'ep-1', url: 'https://a.com', events: ['ticket.called'], secret: 'secret123' },
      ]);
      fetchSpy.mockRejectedValue(new Error('DNS resolution failed'));

      // Should not throw
      await expect(
        service.dispatchEvent('org-1', 'ticket.called', { id: 't-1' }),
      ).resolves.not.toThrow();

      expect(fetchSpy).toHaveBeenCalled();
    });
  });
});
