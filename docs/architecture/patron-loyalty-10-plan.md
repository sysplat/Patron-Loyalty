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

## Phase 2 — Loyalty domain layering

Split controllers and god services; transaction discipline at use-case boundary.

See conversation plan for Phases 3–7 (schema, auth, tests, connector observability, ops).
