# Enterprise Remediation Acceptance Matrix

> **QMS sibling repo:** References to `apps/web` or `apps/admin` describe the **QlessQ** queue product in the sibling `../QMS` repository — not Patron Loyalty (`apps/loyalty`). See [REPO_BOUNDARIES.md](../architecture/REPO_BOUNDARIES.md).

This matrix is the release gate for each remediation PR.

Evidence for the current closure wave: `main` branch CI (`.github/workflows/ci.yml`) and checked items below. Historical remediation commits remain in git history for audit.

## Auth and security

- [x] Web and admin protected routes deny anonymous requests server-side. (middleware + `security:check:auth-remediation`)
- [x] Login, refresh, logout, and impersonation flows succeed with HttpOnly cookie path. (BFF routes + prior commits `49d3745`, `f39a30a`)
- [x] Browser storage inspection confirms no persisted refresh token. (auth store `partialize` + remediation guards)
- [x] Browser storage inspection confirms no persisted access token at rest in browser storage. (HttpOnly cookies; in-memory access token only for API calls)
- [x] CSP/security headers are present on primary app routes. (`scripts/next-security-headers.cjs`, web/admin `next.config.js`)
- [x] Display session tokens are not persisted in `localStorage`. (`security:check:display-session`, display BFF cookies)

## Correctness

- [x] Tenant status updates in admin use coherent React Query keys and optimistic updates. (`tenant-query-keys.ts`, `tenant-mutation-cache.ts`, tenants list + detail pages)
- [x] Broken auth links and route errors are resolved. (middleware allows `/forgot-password` while signed in; admin web URL default `3000`; settings copy)
- [x] Pulse/health messaging reflects real backend data or neutral copy. (admin pulse uses neutral trend labels + live API counts)
- [x] Public track/book/appointment calls use standardized API wrappers. (`apps/web/src/lib/public-api.ts`)

## Maintainability

- [x] Shared auth and API primitives are reused between web and admin. (`@queueplatform/shared` cookie constants + BFF helpers)
- [x] New high-risk files have targeted tests. (realtime service spec extended; display session CI guard)
- [x] Route-level loading and error handling exists for critical pages. (`(dashboard)/loading.tsx`, `error.tsx`, serve + track + book + login segment errors)

## Performance

- [x] Polling policy follows realtime-connected behavior. (`polling-policy.ts`, `useOrgRealtimeConnected`, serve surfaces + track SSE gating)
- [x] Hidden tab polling reduced for non-critical views. (admin layout unread-count uses `useTabVisible`)
- [x] Bundle budgets checked in CI for web/admin dashboards. (`pnpm check:bundle-budgets` in CI)

## Validation commands

Run at minimum:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @queueplatform/web build
pnpm --filter @queueplatform/admin build
pnpm --filter @queueplatform/api test
pnpm security:check:public-safeguards
pnpm security:check:auth-remediation
pnpm security:check:display-session
pnpm check:bundle-budgets
```

## Exit criteria

A phase is complete only when:

1. Acceptance items for that phase are all checked.
2. CI is green.
3. Rollback instructions are documented in the PR body.

## Remaining ops gates (runbooks + verification)

Runnable in repo; Railway dashboard sign-off still required for secrets and provider delivery.

- [x] Serve-surface audit runbook (`docs/qa/SERVE_SURFACE_MIGRATION_RUNBOOK.md`, `pnpm --filter @queueplatform/database audit:serve-surface`)
- [x] Staging SMS/email smoke procedure (`docs/operations/FINAL_PRE_RELEASE_AUDIT.md` §4, `pnpm smoke:rbac-e2e`)
- [x] Centrifugo webhook documented + API verifier (`docs/deployment/OPS_GATE_REALTIME.md`, `pnpm check:ops-gates`) — configure secret on **qms-api** and proxy on Centrifugo in Railway
- [x] CSP strict rollout documented (`docs/operations/FINAL_PRE_RELEASE_AUDIT.md` §6, `docs/deployment/DEPLOYMENT_GUIDE.md`) — enable `CSP_STRICT_MODE=1` on staging after clean report-only window
