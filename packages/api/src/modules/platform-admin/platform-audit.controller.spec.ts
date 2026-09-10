import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformAuditController } from './platform-audit.controller';

describe('PlatformAuditController eventType filter', () => {
  const findMany = vi.fn().mockResolvedValue([]);
  const count = vi.fn().mockResolvedValue(0);
  let controller: PlatformAuditController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new PlatformAuditController({
      platformAuditEvent: { findMany, count },
    } as never);
  });

  it('treats trailing * as prefix match for auth.*', async () => {
    await controller.listEvents(undefined, undefined, 'auth.*');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          eventType: { startsWith: 'auth.', mode: 'insensitive' },
        }),
      }),
    );
  });

  it('uses exact match without wildcard', async () => {
    await controller.listEvents(undefined, undefined, 'auth.login_failed');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          eventType: { equals: 'auth.login_failed', mode: 'insensitive' },
        }),
      }),
    );
  });

  it('filters actor email with prefix match', async () => {
    await controller.listEvents(undefined, undefined, undefined, undefined, 'Darhonar@Gmail.com');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          actorEmail: { startsWith: 'darhonar@gmail.com', mode: 'insensitive' },
        }),
      }),
    );
  });
});
