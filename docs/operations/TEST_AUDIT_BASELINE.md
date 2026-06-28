# Test audit baseline

**Date:** 2026-06-27  
**Repo:** Patron Loyalty (`sysplatLMS`)  
**Purpose:** Pre-fix inventory before test audit implementation.

## Command results

| Command                                                                                             | Exit | Result                                                                                            | Owner                            |
| --------------------------------------------------------------------------------------------------- | ---: | ------------------------------------------------------------------------------------------------- | -------------------------------- |
| `pnpm validate`                                                                                     |    0 | lint + typecheck + legal placeholders pass                                                        | OK                               |
| `pnpm test`                                                                                         |    1 | `@queueplatform/loyalty` — no test files, Vitest exit 1; turbo cancelled api/shared/notifications | **Code** — loyalty vitest config |
| `pnpm --filter @queueplatform/api test -- tenant-isolation.spec.ts` (no `INTEGRATION_DATABASE_URL`) |    0 | 4 tests skipped                                                                                   | Expected                         |
| `pnpm audit:patron-loyalty`                                                                         |    0 | 14/14 checks pass                                                                                 | OK                               |
| CI `validate:ci`                                                                                    |    — | Script missing from package.json                                                                  | **CI drift**                     |
| CI `check:bundle-budgets`                                                                           |    — | Script missing                                                                                    | **CI drift**                     |
| CI e2e admin/realtime                                                                               |    — | Missing `apps/web`, `apps/admin`, `@queueplatform/e2e`                                            | **CI drift**                     |

## Package test inventory

| Package                        | Spec files | Notes                                                  |
| ------------------------------ | ---------- | ------------------------------------------------------ |
| `@queueplatform/api`           | ~45        | Includes 76 ticket tests, 8 loyalty audit specs        |
| `@queueplatform/shared`        | 19         | Validators + utils                                     |
| `@queueplatform/notifications` | 2          | SMS + dead-letter                                      |
| `@queueplatform/loyalty`       | 0          | Vitest deps present, no specs → **blocks `pnpm test`** |
| `@queueplatform/database`      | —          | No test script                                         |
| `@queueplatform/frontend-core` | —          | No test script                                         |

## Untested LMS-critical API modules

- `loyalty-portal.service.ts` — wallet history, consent
- `loyalty-crm-extended.service.ts` — tickets, opportunities
- `loyalty-account.service.ts` — `lookupPatronByPhone` (partial coverage via earn rules)
- `loyalty-webhook.service.ts` — outbound dispatch (org webhooks covered separately)

## Classification summary

- **CI drift:** missing scripts, QMS e2e jobs
- **Code:** loyalty app empty vitest suite blocks monorepo test
- **Env:** RLS integration requires `INTEGRATION_DATABASE_URL`
- **Prod:** audit smoke partial without `LOYALTY_SMOKE_*`

## Post-fix (2026-06-27)

After test audit implementation:

- `validate:ci`, `test:ci`, `check:bundle-budgets` added to root `package.json`
- `@queueplatform/loyalty` vitest specs unblock `pnpm test`
- `@queueplatform/e2e` Playwright package + CI job `test-e2e-loyalty`
- QMS e2e jobs removed from CI
- Audit script runs full `pnpm test` instead of subset vitest globs
