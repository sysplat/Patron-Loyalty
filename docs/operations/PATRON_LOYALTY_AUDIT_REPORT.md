# Patron Loyalty audit report

**Date:** 2026-06-29  
**Prod URL:** https://pl-loyalty-production.up.railway.app  
**Command:** `pnpm audit:patron-loyalty`

## Summary

| Result | Count |
| ------ | ----: |
| Pass   |    15 |
| Fail   |     0 |
| Skip   |     1 |
| Warn   |     0 |

**Verdict:** **PASS** (no blocking failures)

**Unit tests:** Full `pnpm test` (api + shared + notifications + loyalty) is included in the `unit-tests` check.

**E2E:** Playwright smoke (`@queueplatform/e2e`) runs in CI job `test-e2e-loyalty`; optional locally via `pnpm --filter @queueplatform/e2e test`.

## Checklist

| Check                  | Category     | Status | Detail                                                                                                                                                 |
| ---------------------- | ------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| git-head               | Deploy       | PASS   | 1db5f68 P3/P5: 80% loyalty coverage gate; Sentry scorecard 9.95                                                                                        |
| validate-ci            | Code quality | PASS   | • turbo 2.9.16                                                                                                                                         |
| loyalty-coverage       | Tests        | PASS   | [33mThe CJS build of Vite's Node API is deprecated. See https://vite.dev/guide/troubleshooting.html#vite-cjs-node-api-deprecated for more details.[39m |
| loyalty-integration-db | Tests        | SKIP   | set INTEGRATION_DATABASE_URL for earn/idempotency golden-path spec                                                                                     |
| unit-tests             | Tests        | PASS   | • turbo 2.9.16                                                                                                                                         |
| legal-placeholders     | Compliance   | PASS   | Legal placeholder check passed.                                                                                                                        |
| loyalty-auth-guards    | Security     | PASS   | HttpOnly cookies, token not persisted, refresh fallback                                                                                                |
| srs-completion-doc     | SRS          | PASS   | Overall SRS ~88% (see srs-completion.md)                                                                                                               |
| staging-soak           | Prod smoke   | PASS   | boundary curls OK                                                                                                                                      |
| prod-migration         | Database     | PASS   | └─────────────────────────────────────────────────────────┘                                                                                            |
| loyalty-auth-smoke     | Prod smoke   | PASS   | All smoke checks passed.                                                                                                                               |
| sentry-prod            | Operability  | PASS   | health/meta sentryEnabled                                                                                                                              |
| prod-login             | Prod smoke   | PASS   | HTTP 200 /login                                                                                                                                        |
| prod-manifest          | Prod smoke   | PASS   | HTTP 200 /manifest.webmanifest                                                                                                                         |
| prod-icon-192          | Prod smoke   | PASS   | HTTP 200 /brand/icon-192.png                                                                                                                           |
| prod-session-unauth    | Prod smoke   | PASS   | HTTP 401 /api/auth/session                                                                                                                             |

## Manual follow-ups

- [ ] `railway link` → `pnpm db:migrate:status:railway` (migration `20260627120000_srs_crm_gamification_locale`)
- [ ] Set `LOYALTY_SMOKE_EMAIL` / `LOYALTY_SMOKE_PASSWORD` GitHub secrets (optional — CI seeds `ci-loyalty-staff@queueplatform.test`)
- [ ] Set `INTEGRATION_DATABASE_URL` for pre-release DB golden-path spec (`pnpm audit:loyalty-integration-db`)
- [ ] Set `LOYALTY_INTEGRATION_API_KEY` and run `pnpm audit:loyalty-queue-events-smoke`
- [ ] Counsel sign-off per `docs/compliance/PATRON_LOYALTY_LAUNCH_CHECKLIST.md`
- [ ] QlessQ connector smoke: ticket complete → points ledger (or queue-events smoke script)
- [ ] Webhook: create endpoint + rotate signing secret on prod
- [ ] Set `TWILIO_WHATSAPP_NUMBER` if using WhatsApp campaigns

## References

- [Testing guide](./TESTING.md) — LMS commands, CI matrix, release gates
- [Test audit baseline](./TEST_AUDIT_BASELINE.md)
- [SRS completion map](../architecture/srs-completion.md)
- [Launch checklist](../compliance/PATRON_LOYALTY_LAUNCH_CHECKLIST.md)
- [Final pre-release audit](./FINAL_PRE_RELEASE_AUDIT.md) (QMS legacy — partial applicability)
