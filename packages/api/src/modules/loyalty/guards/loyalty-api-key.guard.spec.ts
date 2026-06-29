import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoyaltyApiKeyGuard, LOYALTY_ORG_ID_REQUEST_KEY } from './loyalty-api-key.guard';

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

describe('LoyaltyApiKeyGuard', () => {
  const resolveOrgId = vi.fn();
  const apiKeys = { resolveOrgId };
  let guard: LoyaltyApiKeyGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new LoyaltyApiKeyGuard(apiKeys as never);
  });

  it('throws when X-Loyalty-Api-Key header is missing', async () => {
    const { context } = buildContext();
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context)).rejects.toThrow(/Missing X-Loyalty-Api-Key/);
    expect(resolveOrgId).not.toHaveBeenCalled();
  });

  it('throws when header is an empty array', async () => {
    const { context } = buildContext({ 'x-loyalty-api-key': [] });
    await expect(guard.canActivate(context)).rejects.toThrow(/Missing X-Loyalty-Api-Key/);
  });

  it('throws when API key does not resolve to an org', async () => {
    resolveOrgId.mockResolvedValue(null);
    const { context } = buildContext({ 'x-loyalty-api-key': 'lms_invalid' });
    await expect(guard.canActivate(context)).rejects.toThrow(/Invalid loyalty API key/);
    expect(resolveOrgId).toHaveBeenCalledWith('lms_invalid');
  });

  it('uses first value when header is an array', async () => {
    resolveOrgId.mockResolvedValue(ORG_ID);
    const { context, request } = buildContext({
      'x-loyalty-api-key': ['ignored', 'lms_live_key'],
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(resolveOrgId).toHaveBeenCalledWith('ignored');
    expect(request[LOYALTY_ORG_ID_REQUEST_KEY]).toBe(ORG_ID);
  });

  it('attaches org id to request and returns true for valid key', async () => {
    resolveOrgId.mockResolvedValue(ORG_ID);
    const { context, request } = buildContext({ 'x-loyalty-api-key': 'lms_live_valid' });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request[LOYALTY_ORG_ID_REQUEST_KEY]).toBe(ORG_ID);
  });
});
