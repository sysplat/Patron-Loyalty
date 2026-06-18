import { INTERNAL_PLATFORM_ORG_SLUG } from '@queueplatform/shared';

/**
 * Who may act as a QlessQ platform operator (cross-tenant ops).
 *
 * Primary rule: membership in {@link INTERNAL_PLATFORM_ORG_SLUG} (no env needed for dashboard-created admins).
 * Optional env allowlist: `PLATFORM_OPERATOR_EMAILS` / `PLATFORM_OPERATOR_USER_IDS` for bootstrap or break-glass.
 * Tenant web: prefer `platformOperator` from login / refresh / `GET /auth/session`; optional `NEXT_PUBLIC_PLATFORM_OPERATOR_*` is legacy UX only.
 */
export function parseCsvEnv(value: string | undefined): string[] {
  return String(value ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export function isPlatformOperator(
  userId: string,
  email: string,
  orgSlug: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  // 1. Users in the internal platform org (created via Admin dashboard “Admins”).
  if (orgSlug === INTERNAL_PLATFORM_ORG_SLUG) return true;

  // 2. Env-based allowlist: bootstrap / emergency access without internal-org membership.
  const operatorUserIds = parseCsvEnv(env.PLATFORM_OPERATOR_USER_IDS);
  const operatorEmails = parseCsvEnv(env.PLATFORM_OPERATOR_EMAILS).map((e) => e.toLowerCase());

  const idAllowed = operatorUserIds.includes(userId);
  const em = String(email ?? '')
    .trim()
    .toLowerCase();
  const emailAllowed = em.length > 0 && operatorEmails.includes(em);

  return idAllowed || emailAllowed;
}
