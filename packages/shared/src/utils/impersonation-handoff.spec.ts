import { describe, expect, it } from 'vitest';
import {
  buildImpersonationLaunchUrl,
  decodeImpersonationHandoff,
  encodeImpersonationHandoff,
  impersonationHandoffToSession,
  parseImpersonationHandoffFromHash,
} from './impersonation-handoff';

const samplePayload = {
  accessToken: 'jwt-token',
  orgId: 'org-1',
  orgName: 'Demo Org',
  operatorOrgSlug: 'queueplatform-internal',
  role: 'owner',
  roleSimulation: false,
  operator: {
    id: 'user-1',
    email: 'ops@example.com',
    firstName: 'Pat',
    lastName: 'Ops',
  },
} as const;

describe('impersonation-handoff', () => {
  it('round-trips payload through base64url encoding', () => {
    const encoded = encodeImpersonationHandoff(samplePayload);
    expect(decodeImpersonationHandoff(encoded)).toEqual(samplePayload);
  });

  it('builds dashboard URL with hash handoff', () => {
    const url = buildImpersonationLaunchUrl(
      'https://qms-web-production.up.railway.app',
      '/dashboard',
      samplePayload,
    );
    expect(url.startsWith('https://qms-web-production.up.railway.app/dashboard#qp-imp=')).toBe(
      true,
    );
    const hash = url.slice(url.indexOf('#'));
    expect(parseImpersonationHandoffFromHash(hash)).toEqual(samplePayload);
  });

  it('maps payload to auth session for tenant apps', () => {
    const session = impersonationHandoffToSession(samplePayload);
    expect(session.accessToken).toBe('jwt-token');
    expect(session.user.orgId).toBe('org-1');
    expect(session.user.orgSlug).toBe('queueplatform-internal');
    expect(session.user.impersonation).toBe(true);
    expect(session.user.twoFactorEnabled).toBe(true);
  });
});
