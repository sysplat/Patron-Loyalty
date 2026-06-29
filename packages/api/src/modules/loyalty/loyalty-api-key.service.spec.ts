import { createHash } from 'crypto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LOYALTY_INTEGRATION_API_KEY_SETTING } from '@queueplatform/shared';
import { LoyaltyApiKeyService } from './loyalty-api-key.service';

const ORG_ID = '00000000-0000-0000-0000-000000000099';
const RAW_KEY = `lms_${'a'.repeat(64)}`;
const KEY_HASH = createHash('sha256').update(RAW_KEY).digest('hex');

describe('LoyaltyApiKeyService', () => {
  const patronCrmFeature = { isEnabled: vi.fn(), requireEnabled: vi.fn() };
  const settingFindFirst = vi.fn();
  const settingUpdate = vi.fn();
  const prisma = {
    withBypassRls: vi.fn(),
    withTenant: vi.fn(),
  };

  let service: LoyaltyApiKeyService;

  beforeEach(() => {
    vi.clearAllMocks();
    patronCrmFeature.isEnabled.mockResolvedValue(true);
    settingUpdate.mockResolvedValue({ id: 'setting-1' });

    prisma.withBypassRls.mockImplementation((_fn: (tx: unknown) => unknown) =>
      _fn({ setting: { findFirst: settingFindFirst } }),
    );
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({ setting: { findFirst: settingFindFirst, update: settingUpdate } }),
    );

    service = new LoyaltyApiKeyService(prisma as never, patronCrmFeature as never);
  });

  it('returns org id and records lastUsedAt on successful key resolution', async () => {
    const stored = {
      id: 'setting-1',
      value: {
        hash: KEY_HASH,
        prefix: RAW_KEY.slice(0, 12),
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    };
    settingFindFirst
      .mockResolvedValueOnce({ orgId: ORG_ID })
      .mockResolvedValueOnce(stored)
      .mockResolvedValueOnce({ id: 'setting-1' });

    const orgId = await service.resolveOrgId(RAW_KEY);

    expect(orgId).toBe(ORG_ID);
    await vi.waitFor(() => {
      expect(settingUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'setting-1' },
          data: {
            value: expect.objectContaining({
              hash: KEY_HASH,
              lastUsedAt: expect.any(String),
            }),
          },
        }),
      );
    });
  });

  it('exposes lastUsedAt in getStatus when present', async () => {
    settingFindFirst.mockResolvedValue({
      value: {
        hash: KEY_HASH,
        prefix: RAW_KEY.slice(0, 12),
        createdAt: '2026-01-01T00:00:00.000Z',
        lastUsedAt: '2026-06-29T01:00:00.000Z',
      },
    });

    const status = await service.getStatus(ORG_ID);

    expect(status).toEqual({
      configured: true,
      prefix: RAW_KEY.slice(0, 12),
      createdAt: '2026-01-01T00:00:00.000Z',
      lastUsedAt: '2026-06-29T01:00:00.000Z',
    });
  });

  it('returns null for keys without lms_ prefix', async () => {
    await expect(service.resolveOrgId('bad-key')).resolves.toBeNull();
    expect(prisma.withBypassRls).not.toHaveBeenCalled();
  });

  it('rotateKey persists hashed key under integration setting', async () => {
    patronCrmFeature.requireEnabled.mockResolvedValue(undefined);
    const settingCreate = vi.fn().mockResolvedValue({ id: 'new-setting' });
    settingFindFirst.mockResolvedValue(null);
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        setting: {
          findFirst: settingFindFirst,
          create: settingCreate,
          update: settingUpdate,
        },
      }),
    );

    const result = await service.rotateKey(ORG_ID);

    expect(result.apiKey.startsWith('lms_')).toBe(true);
    expect(settingCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orgId: ORG_ID,
          key: LOYALTY_INTEGRATION_API_KEY_SETTING,
          value: expect.objectContaining({
            prefix: result.prefix,
            hash: expect.any(String),
            createdAt: expect.any(String),
          }),
        }),
      }),
    );
  });
});
