import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RealtimeService } from './realtime.service';

describe('RealtimeService subscription authorization', () => {
  const config = { get: vi.fn().mockReturnValue('secret') } as any;
  const jwt = {
    sign: vi.fn().mockReturnValue('signed-token'),
    verify: vi.fn(),
  } as any;
  const prisma = {
    queue: { findUnique: vi.fn() },
    displayDevice: { findUnique: vi.fn() },
    withBypassRls: vi.fn(async (cb) => cb(prisma)),
  } as any;

  let service: RealtimeService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RealtimeService(config, jwt, prisma);
  });

  it('allows org namespace when token org matches', async () => {
    const allowed = await service.authorizeSubscription({
      userId: 'user-1',
      channel: 'org:org-1',
      info: { type: 'user', orgId: 'org-1' },
    });
    expect(allowed).toBe(true);
  });

  it('denies org namespace when token org mismatches', async () => {
    const allowed = await service.authorizeSubscription({
      userId: 'user-1',
      channel: 'org:org-2',
      info: { type: 'user', orgId: 'org-1' },
    });
    expect(allowed).toBe(false);
  });

  it('allows queue namespace only when queue belongs to token org', async () => {
    prisma.queue.findUnique.mockResolvedValueOnce({ orgId: 'org-1' });
    const allowed = await service.authorizeSubscription({
      userId: 'user-1',
      channel: 'queue:queue-1',
      info: { type: 'user', orgId: 'org-1' },
    });
    expect(allowed).toBe(true);
  });

  it('denies display namespace when branch claim mismatches', async () => {
    const allowed = await service.authorizeSubscription({
      userId: 'device-1',
      channel: 'display:branch-2',
      info: { type: 'display', orgId: 'org-1', branchId: 'branch-1' },
    });
    expect(allowed).toBe(false);
  });

  it('verifies display session token payload', () => {
    jwt.verify.mockReturnValueOnce({ did: 'device-1', typ: 'display' });
    const verified = service.verifyDisplaySessionToken('display-session');
    expect(verified.deviceId).toBe('device-1');
  });

  it('rejects invalid display session token type', () => {
    jwt.verify.mockReturnValueOnce({ did: 'device-1', typ: 'user' });
    expect(() => service.verifyDisplaySessionToken('bad')).toThrow();
  });

  it('allows webhook auth in non-production when secret is unset', () => {
    config.get.mockImplementation((key: string) => {
      if (key === 'app.centrifugo.webhookSecret') return '';
      if (key === 'app.nodeEnv') return 'development';
      return 'secret';
    });
    expect(service.isValidWebhookAuth(undefined)).toBe(true);
  });

  it('requires webhook secret in production', () => {
    config.get.mockImplementation((key: string) => {
      if (key === 'app.centrifugo.webhookSecret') return 'hook-secret';
      if (key === 'app.nodeEnv') return 'production';
      return 'secret';
    });
    expect(service.isValidWebhookAuth('hook-secret')).toBe(true);
    expect(service.isValidWebhookAuth('wrong')).toBe(false);
  });
});
