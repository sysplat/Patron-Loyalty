import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebhookService } from './webhook.service';

describe('WebhookService secret exposure', () => {
  const prisma = {
    withTenant: vi.fn(),
  };
  const redis = {} as never;
  const requestContext = { getRequestId: vi.fn() } as never;
  let service: WebhookService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WebhookService(prisma as never, redis, requestContext);
  });

  it('strips secret from list and create responses', async () => {
    const row = {
      id: 'wh-1',
      orgId: 'org-1',
      url: 'https://example.com/hook',
      events: ['*'],
      secret: 'whsec_abc',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastTriggeredAt: null,
    };
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        webhookEndpoint: {
          findMany: vi.fn().mockResolvedValue([row]),
          create: vi.fn().mockResolvedValue(row),
        },
      }),
    );

    const listed = await service.list('org-1');
    expect(listed[0]).not.toHaveProperty('secret');

    const created = await service.create('org-1', {
      url: 'https://example.com/hook',
      events: ['loyalty.points.earned'],
    });
    expect(created).not.toHaveProperty('secret');
  });

  it('returns secret only on rotate', async () => {
    const updated = {
      id: 'wh-1',
      orgId: 'org-1',
      url: 'https://example.com/hook',
      events: ['*'],
      secret: 'whsec_new',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastTriggeredAt: null,
    };
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        webhookEndpoint: {
          findFirst: vi.fn().mockResolvedValue({ id: 'wh-1' }),
          update: vi.fn().mockResolvedValue(updated),
        },
      }),
    );

    const rotated = await service.rotateSecret('org-1', 'wh-1');
    expect(rotated.secret).toMatch(/^whsec_/);
  });
});
