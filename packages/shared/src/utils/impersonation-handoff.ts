/** URL hash key for cross-origin platform-operator impersonation launch. */
export const IMPERSONATION_HANDOFF_HASH_KEY = 'qp-imp';

export type ImpersonationHandoffPayload = {
  accessToken: string;
  orgId: string;
  orgName: string;
  /** Platform operator org slug (e.g. queueplatform-internal) — not the impersonated tenant slug. */
  operatorOrgSlug: string;
  role: string;
  roleSimulation?: boolean;
  simulatedBranchId?: string;
  simulatedBranchName?: string;
  operator: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  };
};

export type ImpersonationAuthSession = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    orgId: string;
    orgName: string;
    orgSlug: string;
    role: string;
    twoFactorEnabled: true;
    impersonation: true;
    roleSimulation?: boolean;
    simulatedBranchId?: string;
    simulatedBranchName?: string;
    platformOperator: true;
  };
};

function toBase64Url(value: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'utf8').toString('base64url');
  }
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(padded, 'base64').toString('utf8');
  }
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeImpersonationHandoff(payload: ImpersonationHandoffPayload): string {
  return toBase64Url(JSON.stringify(payload));
}

export function decodeImpersonationHandoff(encoded: string): ImpersonationHandoffPayload | null {
  try {
    const parsed = JSON.parse(fromBase64Url(encoded)) as ImpersonationHandoffPayload;
    if (
      typeof parsed?.accessToken !== 'string' ||
      typeof parsed?.orgId !== 'string' ||
      typeof parsed?.orgName !== 'string' ||
      typeof parsed?.operatorOrgSlug !== 'string' ||
      typeof parsed?.role !== 'string' ||
      typeof parsed?.operator?.id !== 'string' ||
      typeof parsed?.operator?.email !== 'string'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function impersonationHandoffToSession(
  payload: ImpersonationHandoffPayload,
): ImpersonationAuthSession {
  return {
    accessToken: payload.accessToken,
    user: {
      id: payload.operator.id,
      email: payload.operator.email,
      firstName: payload.operator.firstName?.trim() || 'Platform',
      lastName: payload.operator.lastName?.trim() || 'Operator',
      orgId: payload.orgId,
      orgName: payload.orgName,
      orgSlug: payload.operatorOrgSlug,
      role: payload.role,
      twoFactorEnabled: true,
      impersonation: true,
      roleSimulation: payload.roleSimulation,
      simulatedBranchId: payload.simulatedBranchId,
      simulatedBranchName: payload.simulatedBranchName,
      platformOperator: true,
    },
  };
}

/** Build tenant app URL with hash handoff (admin → web/loyalty on another origin). */
export function buildImpersonationLaunchUrl(
  appBaseUrl: string,
  path: string,
  payload: ImpersonationHandoffPayload,
): string {
  const base = appBaseUrl.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const encoded = encodeImpersonationHandoff(payload);
  return `${base}${normalizedPath}#${IMPERSONATION_HANDOFF_HASH_KEY}=${encoded}`;
}

export function parseImpersonationHandoffFromHash(
  hash: string,
): ImpersonationHandoffPayload | null {
  const prefix = `#${IMPERSONATION_HANDOFF_HASH_KEY}=`;
  if (!hash.startsWith(prefix)) return null;
  return decodeImpersonationHandoff(hash.slice(prefix.length));
}
