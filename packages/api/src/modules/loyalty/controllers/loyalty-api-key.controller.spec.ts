import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LoyaltyApiKeyController } from './loyalty-api-key.controller';

const ORG_ID = '00000000-0000-0000-0000-000000000099';
const USER = {
  id: 'user-1',
  orgId: ORG_ID,
  email: 'staff@example.com',
} as never;

describe('LoyaltyApiKeyController', () => {
  const apiKeys = {
    getStatus: vi.fn(),
    rotateKey: vi.fn(),
    revokeKey: vi.fn(),
  };
  let controller: LoyaltyApiKeyController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new LoyaltyApiKeyController(apiKeys as never);
  });

  it('returns integration API key status for the user org', async () => {
    apiKeys.getStatus.mockResolvedValue({
      configured: true,
      prefix: 'lms_abc',
      lastUsedAt: null,
    });
    await expect(controller.getIntegrationApiKeyStatus(USER)).resolves.toEqual({
      configured: true,
      prefix: 'lms_abc',
      lastUsedAt: null,
    });
    expect(apiKeys.getStatus).toHaveBeenCalledWith(ORG_ID);
  });

  it('rotates integration API key for the user org', async () => {
    apiKeys.rotateKey.mockResolvedValue({ apiKey: 'lms_new', prefix: 'lms_new' });
    await expect(controller.rotateIntegrationApiKey(USER)).resolves.toEqual({
      apiKey: 'lms_new',
      prefix: 'lms_new',
    });
    expect(apiKeys.rotateKey).toHaveBeenCalledWith(ORG_ID);
  });

  it('revokes integration API key for the user org', async () => {
    apiKeys.revokeKey.mockResolvedValue(undefined);
    await controller.revokeIntegrationApiKey(USER);
    expect(apiKeys.revokeKey).toHaveBeenCalledWith(ORG_ID);
  });
});
