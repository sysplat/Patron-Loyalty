# Continuous Assurance Controls

This document defines the recurring controls that keep QMS security posture measurable between audits.

## CI Security Gates

Required on each PR:

1. Dependency vulnerability scan (`pnpm audit --prod --audit-level=high`)
2. Lint + typecheck (`pnpm turbo run lint typecheck`)
3. Public safeguards check (`node scripts/security/check-public-safeguards.mjs`)
4. Auth remediation guards (`node scripts/security/check-auth-remediation-guards.mjs`)
5. Display session guards (`node scripts/security/check-display-session-guards.mjs`)
6. Bundle budget check (`pnpm check:bundle-budgets`, after web/admin build)
7. Unit tests for security-sensitive modules (`@queueplatform/api`, `@queueplatform/shared`)

## Weekly Controls

- Review immutable audit export delivery health and retry/error counts.
- Review throttling metrics (429 rates) on public endpoints.
- Review failed login spikes by IP / user agent.

## Monthly Controls

- Validate PII anonymization scheduler results and legal-hold exceptions.
- Run restore validation for audit evidence storage.
- Run `pnpm compliance:backfill-legacy-sms-consent` and resolve any customers lacking consent evidence.
- Run `pnpm compliance:backfill-legacy-sms-templates` and apply updates for legacy SMS templates missing org-specific disclosure handling.
- Verify notification consent policy enforcement for transactional SMS (consent, STOP/ARRET, HELP).
- Verify US tenants sending SMS have `sms_a2p_registration_status=APPROVED`.

## Quarterly Controls

- Access review (platform operator and org-owner effective permissions).
- Tenant isolation verification (cross-tenant query denial tests).
- Incident tabletop exercise and after-action signoff.
