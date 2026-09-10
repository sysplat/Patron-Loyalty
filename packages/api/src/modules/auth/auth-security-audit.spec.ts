import { describe, expect, it, vi } from 'vitest';
import { AUTH_AUDIT_EVENTS, recordAuthAudit } from './auth-security-audit';

describe('recordAuthAudit', () => {
  it('no-ops when platform audit is missing', async () => {
    await expect(
      recordAuthAudit(undefined, {
        eventType: AUTH_AUDIT_EVENTS.loginFailed,
        email: 'User@Example.com',
        outcome: 'invalid_credentials',
      }),
    ).resolves.toBeUndefined();
  });

  it('normalizes email and attaches outcome metadata', async () => {
    const log = vi.fn().mockResolvedValue(undefined);
    await recordAuthAudit({ log } as never, {
      eventType: AUTH_AUDIT_EVENTS.passwordResetRequested,
      email: '  Darhonar@Gmail.com ',
      outcome: 'not_owner',
      subjectOrgId: 'org-1',
      actorUserId: 'user-1',
      metadata: { orgSlug: 'bc-skincare' },
    });

    expect(log).toHaveBeenCalledWith({
      actorEmail: 'darhonar@gmail.com',
      actorUserId: 'user-1',
      eventType: AUTH_AUDIT_EVENTS.passwordResetRequested,
      severity: 'warning',
      subjectOrgId: 'org-1',
      metadata: {
        outcome: 'not_owner',
        orgSlug: 'bc-skincare',
      },
    });
  });

  it('defaults failed events to warning severity', async () => {
    const log = vi.fn().mockResolvedValue(undefined);
    await recordAuthAudit({ log } as never, {
      eventType: AUTH_AUDIT_EVENTS.loginFailed,
      email: 'a@b.com',
      outcome: 'unknown_email',
    });
    expect(log.mock.calls[0][0].severity).toBe('warning');
  });

  it('defaults email_queue_failed to critical', async () => {
    const log = vi.fn().mockResolvedValue(undefined);
    await recordAuthAudit({ log } as never, {
      eventType: AUTH_AUDIT_EVENTS.passwordResetRequested,
      email: 'a@b.com',
      outcome: 'email_queue_failed',
    });
    expect(log.mock.calls[0][0].severity).toBe('critical');
  });

  it('swallows audit log failures so auth is not blocked', async () => {
    const log = vi.fn().mockRejectedValue(new Error('db down'));
    await expect(
      recordAuthAudit({ log } as never, {
        eventType: AUTH_AUDIT_EVENTS.loginFailed,
        email: 'a@b.com',
        outcome: 'invalid_credentials',
      }),
    ).resolves.toBeUndefined();
  });

  it('keeps canonical outcome when metadata also has outcome', async () => {
    const log = vi.fn().mockResolvedValue(undefined);
    await recordAuthAudit({ log } as never, {
      eventType: AUTH_AUDIT_EVENTS.loginFailed,
      email: 'a@b.com',
      outcome: 'invalid_credentials',
      metadata: { outcome: 'success' as never, reason: 'test' },
    });
    expect(log.mock.calls[0][0].metadata).toEqual({
      reason: 'test',
      outcome: 'invalid_credentials',
    });
  });
});
