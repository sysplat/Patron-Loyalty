import { describe, it, expect, vi, beforeEach } from 'vitest';

import { HealthController } from './health.controller';

describe('HealthController', () => {
  const mockPrisma = {
    withBypassRls: vi.fn(async (cb) => cb(mockPrisma)),
    withTenant: vi.fn(async (orgId, cb) => cb(mockPrisma)),
    $queryRaw: vi.fn(),
  };
  const mockRedisClient = {
    ping: vi.fn(),
  };
  const mockRedis = {
    getClient: vi.fn(() => mockRedisClient),
  };

  let controller: HealthController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new HealthController(mockPrisma as never, mockRedis as never);
  });

  describe('live', () => {
    it('returns ok without touching dependencies', () => {
      const result = controller.live();
      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
      expect(mockRedisClient.ping).not.toHaveBeenCalled();
    });
  });

  describe('meta', () => {
    it('returns release metadata without touching dependencies', () => {
      const result = controller.meta();
      expect(result.status).toBe('ok');
      expect(typeof result.release).toBe('string');
      expect(result.release.length).toBeGreaterThan(0);
      expect(typeof result.sentryEnabled).toBe('boolean');
      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('check', () => {
    it('returns ok when database and redis are healthy', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedisClient.ping.mockResolvedValue('PONG');

      const result = await controller.check();

      expect(result.status).toBe('ok');
      expect(result.dependencies).toEqual({ database: 'ok', redis: 'ok' });
      expect(typeof result.uptime).toBe('number');
    });

    it('throws ServiceUnavailableException when a dependency fails', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('connection refused'));
      mockRedisClient.ping.mockResolvedValue('PONG');

      await expect(controller.check()).rejects.toMatchObject({
        response: expect.objectContaining({
          status: 'degraded',
          dependencies: { database: 'error', redis: 'ok' },
        }),
      });
    });
  });
});
