# Patron Loyalty — architecture 10/10 plan

Roadmap to elite architecture for **this repo** (LMS split). The historical QMS plan lives in [10-10-plan.md](./10-10-plan.md).

## Phase 0 — Truth & gates ✅

**Status:** Complete (2026-06-26)

| Item                                                                    | Done                                                                                           |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Canonical repo scope doc                                                | [REPO_BOUNDARIES.md](./REPO_BOUNDARIES.md)                                                     |
| QMS-only banners on legacy docs                                         | `docs/README.md`, `admin-surface.md`, `STANDARDS.md`, `FRONTEND_GUIDE.md`, `patron-loyalty.md` |
| Loyalty middleware trimmed (no `/kiosk`, `/display`, `/track`, `/book`) | `apps/loyalty/src/middleware.ts` + spec                                                        |
| Static gates in `pnpm validate:ci`                                      | `security:check:*`, `check:architecture:api-module-boundary`                                   |
| Queue-events smoke in pre-release docs                                  | `TESTING.md`, `PATRON_LOYALTY_LAUNCH_CHECKLIST.md`, `audit-patron-loyalty.mjs`                 |

## Phase 1 — Product boundary ✅

**Status:** Complete (2026-06-26)

| Item                                         | Done                                                                               |
| -------------------------------------------- | ---------------------------------------------------------------------------------- |
| `API_DEPLOY_PROFILE=loyalty` module registry | `app-modules.registry.ts` — QMS modules omitted at boot                            |
| Loyalty scheduled jobs only                  | `ScheduledJobsLoyaltyModule`                                                       |
| Runtime QMS route guard (full deploy)        | `QueueProductGuard` → 404 when org lacks queue SKU                                 |
| Centrifugo optional on loyalty deploy        | `main.ts` validateEnv                                                              |
| Tests                                        | `app-modules.registry.spec.ts`, `queue-product.guard.spec.ts`, shared profile spec |

Set on **Patron Loyalty Railway `pl-api` service:**

```bash
API_DEPLOY_PROFILE=loyalty
```

## Phase 2 — Loyalty domain layering ✅

**Status:** Complete (2026-06-28)

| Item                                     | Done                                                                                                                                                        |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Split monolithic `loyalty.controller.ts` | `controllers/loyalty-*.controller.ts` (activation, dashboard, program, accounts, catalog, wallet, referrals, campaigns, gamification, CRM, API key, public) |
| Extract points transaction core          | `loyalty-points.service.ts` — ledger, tier, health score, idempotency                                                                                       |
| Account service as lifecycle facade      | `loyalty-account.service.ts` — ensure/get, earn handlers, DSAR, delegates to points                                                                         |

See conversation plan for Phases 4–7 (auth, tests, connector observability, ops).

## Phase 3 — Data & schema clarity (in progress)

**Status:** Started (2026-06-28)

| Item                                                       | Done                                            |
| ---------------------------------------------------------- | ----------------------------------------------- |
| `customers.external_id` column + org-scoped unique index   | Migration `20260628220000_customer_external_id` |
| Integration lookup uses indexed column (metadata fallback) | `loyalty-integration.service.ts`                |
| Product SKU + schema layer matrix                          | [REPO_BOUNDARIES.md](./REPO_BOUNDARIES.md)      |
| Points-layer idempotency spec                              | `loyalty-points.service.spec.ts`                |
| Physical Prisma schema split (`core` / `loyalty` / `qms`)  | Planned — deferred (multi-file preview)         |

## Phase 4 — Auth hardening ✅

**Status:** Complete (2026-06-28)

| Item                                                     | Done                                             |
| -------------------------------------------------------- | ------------------------------------------------ |
| `GET /api/auth/session` returns `{ authenticated }` only | `apps/loyalty/src/app/api/auth/session/route.ts` |
| Cross-tab sync via BFF `POST /api/auth/refresh` only     | `auth-refresh-coordination.ts`, dashboard layout |
| CSP + SameSite audit specs                               | `auth-store.spec.ts`                             |
| Strip accessToken from login BFF JSON (cookies-only)     | `server-auth-bff.ts`, `login/page.tsx`           |

## Phase 5 — Integration API contract tests ✅

**Status:** Complete (2026-06-28)

| Item                                              | Done                                          |
| ------------------------------------------------- | --------------------------------------------- |
| Supertest suite for `/loyalty/integrations/v1/*`  | `loyalty-integration.controller.http.spec.ts` |
| Lookup, idempotent earn replay, extra event types | Same spec (11 cases)                          |

## Phase 6 — QlessQ connector observability ✅

**Status:** Complete (2026-06-28)

| Item                                      | Done                                                             |
| ----------------------------------------- | ---------------------------------------------------------------- |
| Structured ingest logs + latency/outcome  | `loyalty-connector-observability.service.ts`                     |
| 4xx spike warning per org (Redis, 1h)     | Same service                                                     |
| `connectorVersion` on queue-event payload | `@queueplatform/shared`                                          |
| Ops runbook                               | [QLESSQ_CONNECTOR_OPS.md](../operations/QLESSQ_CONNECTOR_OPS.md) |

## Phase 7 — Operability & release discipline (in progress)

**Status:** Started (2026-06-28)

| Item                                       | Done                                                             |
| ------------------------------------------ | ---------------------------------------------------------------- |
| Sentry / health release tag                | `getObservabilityRelease()` in shared + API                      |
| Deploy verification in connector ops doc   | [QLESSQ_CONNECTOR_OPS.md](../operations/QLESSQ_CONNECTOR_OPS.md) |
| Architecture scorecard (quarterly re-rate) | This doc                                                         |
| Nightly load workflow (staging)            | Planned — needs staging secrets                                  |
