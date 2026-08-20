import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoyaltyJwtOrApiKeyGuard } from './loyalty-jwt-or-api-key.guard';
import { LOYALTY_ORG_ID_REQUEST_KEY } from './loyalty-api-key.guard';

const ORG_ID = '00000000-0000-0000-0000-000000000099';

function buildContext(headers: Record<string, string | string[] | undefined> = {}) {
  const request: Record<string, unknown> = { headers };
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
  return { context, request };
}

describe('LoyaltyJwtOrApiKeyGuard', () => {
  const resolveOrgId = vi.fn();
  const verify = vi.fn();
  const apiKeys = { resolveOrgId };
  const jwtService = { verify };
  const config = { get: vi.fn(() => 'test-secret') };
  let guard: LoyaltyJwtOrApiKeyGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new LoyaltyJwtOrApiKeyGuard(apiKeys as never, jwtService as never, config as never);
  });

  it('accepts a valid loyalty API key', async () => {
    resolveOrgId.mockResolvedValue(ORG_ID);
    const { context, request } = buildContext({ 'x-loyalty-api-key': 'lms_live_key' });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request[LOYALTY_ORG_ID_REQUEST_KEY]).toBe(ORG_ID);
    expect(verify).not.toHaveBeenCalled();
  });

  it('accepts a valid JWT bearer token', async () => {
    verify.mockReturnValue({ orgId: ORG_ID });
    const { context, request } = buildContext({ authorization: 'Bearer jwt-token' });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(verify).toHaveBeenCalledWith('jwt-token', { secret: 'test-secret' });
    expect(request[LOYALTY_ORG_ID_REQUEST_KEY]).toBe(ORG_ID);
  });

  it('prefers API key when both headers are present', async () => {
    resolveOrgId.mockResolvedValue(ORG_ID);
    const { context } = buildContext({
      'x-loyalty-api-key': 'lms_live_key',
      authorization: 'Bearer jwt-token',
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(verify).not.toHaveBeenCalled();
  });

  it('throws when neither API key nor JWT is provided', async () => {
    const { context } = buildContext();
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context)).rejects.toThrow(/Missing authentication/);
  });
});
