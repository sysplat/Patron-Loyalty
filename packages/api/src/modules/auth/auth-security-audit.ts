import type { Prisma } from '@prisma/client';
import type { PlatformAuditService } from '../../common/audit/platform-audit.service';

/**
 * Auth security events for support/incident lookup in platform admin Audit Trail.
 * Never include passwords, tokens, TOTP codes, or reset links in metadata.
 */
export const AUTH_AUDIT_EVENTS = {
  loginFailed: 'auth.login_failed',
  loginSuccess: 'auth.login_success',
  loginPending: 'auth.login_pending',
  loginBlocked: 'auth.login_blocked',
  login2faRequired: 'auth.login_2fa_required',
  login2faFailed: 'auth.login_2fa_failed',
  login2faSuccess: 'auth.login_2fa_success',
  passwordResetRequested: 'auth.password_reset_requested',
  passwordResetFailed: 'auth.password_reset_failed',
  passwordResetCompleted: 'auth.password_reset_completed',
  passwordChanged: 'auth.password_changed',
  passwordChangeFailed: 'auth.password_change_failed',
  twoFactorEnabled: 'auth.2fa_enabled',
  twoFactorDisabled: 'auth.2fa_disabled',
  twoFactorBackupRegenerated: 'auth.2fa_backup_regenerated',
  registered: 'auth.registered',
  registerFailed: 'auth.register_failed',
  emailVerified: 'auth.email_verified',
  emailVerifyFailed: 'auth.email_verify_failed',
  emailVerificationResent: 'auth.email_verification_resent',
  emailChangeRequested: 'auth.email_change_requested',
  emailChangeFailed: 'auth.email_change_failed',
  emailChanged: 'auth.email_changed',
  logout: 'auth.logout',
  sessionsRevoked: 'auth.sessions_revoked',
} as const;

export type AuthAuditEventType = (typeof AUTH_AUDIT_EVENTS)[keyof typeof AUTH_AUDIT_EVENTS];

export type AuthAuditOutcome =
  | 'invalid_credentials'
  | 'unknown_email'
  | 'account_user_email_mismatch'
  | 'not_owner'
  | 'user_suspended'
  | 'org_suspended'
  | 'email_unverified'
  | 'email_already_verified'
  | 'email_queued'
  | 'email_queue_failed'
  | 'invalid_2fa_session'
  | 'invalid_2fa_code'
  | '2fa_not_required'
  | 'org_not_available'
  | 'invalid_reset_token'
  | 'invalid_verify_token'
  | 'invalid_password_format'
  | 'wrong_current_password'
  | 'same_as_current'
  | 'email_in_use'
  | 'success'
  | 'requires_onboarding'
  | 'requires_org_selection'
  | 'platform_admin_only'
  | 'already_registered';

const WARNING_OUTCOMES = new Set<AuthAuditOutcome>([
  'invalid_credentials',
  'unknown_email',
  'account_user_email_mismatch',
  'not_owner',
  'user_suspended',
  'email_unverified',
  'email_already_verified',
  'invalid_2fa_session',
  'invalid_2fa_code',
  '2fa_not_required',
  'org_not_available',
  'invalid_reset_token',
  'invalid_verify_token',
  'invalid_password_format',
  'wrong_current_password',
  'same_as_current',
  'email_in_use',
  'platform_admin_only',
  'already_registered',
]);

const CRITICAL_OUTCOMES = new Set<AuthAuditOutcome>(['org_suspended', 'email_queue_failed']);

function defaultSeverity(
  eventType: string,
  outcome: AuthAuditOutcome,
): 'info' | 'warning' | 'critical' {
  if (CRITICAL_OUTCOMES.has(outcome)) return 'critical';
  if (WARNING_OUTCOMES.has(outcome) || eventType.includes('failed')) return 'warning';
  return 'info';
}

/**
 * Best-effort auth audit write. Never throws — auth flows must not fail because audit is down.
 */
export async function recordAuthAudit(
  platformAudit: Pick<PlatformAuditService, 'log'> | null | undefined,
  input: {
    eventType: AuthAuditEventType | string;
    email: string;
    severity?: 'info' | 'warning' | 'critical';
    actorUserId?: string | null;
    subjectOrgId?: string | null;
    outcome: AuthAuditOutcome;
    metadata?: Prisma.InputJsonObject;
  },
): Promise<void> {
  if (!platformAudit || typeof platformAudit.log !== 'function') return;

  try {
    const email = input.email.trim().toLowerCase();
    await platformAudit.log({
      actorEmail: email || null,
      actorUserId: input.actorUserId ?? null,
      eventType: input.eventType,
      severity: input.severity ?? defaultSeverity(input.eventType, input.outcome),
      subjectOrgId: input.subjectOrgId ?? null,
      metadata: {
        ...(input.metadata ?? {}),
        outcome: input.outcome,
      },
    });
  } catch {
    // PlatformAuditService already swallows DB errors; keep a hard outer guard.
  }
}
