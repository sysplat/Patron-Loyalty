# Testing guide (Patron Loyalty)

Single reference for local development, CI, and pre-release gates.

## Tiers

| Tier                        | Command                                 | When                        | Needs prod / Railway                                |
| --------------------------- | --------------------------------------- | --------------------------- | --------------------------------------------------- |
| **Lint + types + gates**    | `pnpm validate`                         | Local quick check           | No                                                  |
| **CI validate**             | `pnpm validate:ci`                      | Every PR, CI `validate` job | No — includes security + architecture static checks |
| **Unit**                    | `pnpm test`                             | Every PR, local dev         | No (excludes `@queueplatform/e2e`)                  |
| **Release gate (local/CI)** | `pnpm test:ci`                          | PR merge, clean clone       | No                                                  |
| **E2E smoke**               | `pnpm --filter @queueplatform/e2e test` | CI + optional local         | No (local servers)                                  |
| **Prod audit**              | `pnpm audit:patron-loyalty`             | Pre-release manual          | Yes                                                 |

## Root commands

```bash
pnpm validate              # lint + typecheck + legal placeholders (no security/architecture gates)
pnpm validate:ci           # validate + public-safeguards + tenant-isolation + api-module-boundary
pnpm test                  # turbo: api, shared, notifications, loyalty
pnpm test:ci               # validate:ci + test
pnpm check:bundle-budgets  # loyalty .next size cap (skips if not built)
pnpm audit:tests           # test:ci + Playwright (needs API + loyalty running for e2e half)
pnpm audit:patron-loyalty  # full prod audit + report (Railway migration, prod smoke)
```

### Static gates (`validate:ci`)

| Script                                   | Purpose                                           |
| ---------------------------------------- | ------------------------------------------------- |
| `security:check:public-safeguards`       | Throttle + PII masking on public/ticket API paths |
| `security:check:tenant-isolation`        | Baseline unsafe Prisma model access               |
| `check:architecture:api-module-boundary` | Cross-module import baseline for `packages/api`   |

QMS-only gate `check:architecture:web-admin-boundary` is **not** run here (requires `apps/web` in sibling QMS repo).

## Package breakdown

| Package                        | Command                                           | Notes                                                                        |
| ------------------------------ | ------------------------------------------------- | ---------------------------------------------------------------------------- |
| `@queueplatform/api`           | `pnpm --filter @queueplatform/api test`           | ~45 specs incl. loyalty + ticket                                             |
| `@queueplatform/shared`        | `pnpm --filter @queueplatform/shared test`        | Validators                                                                   |
| `@queueplatform/notifications` | `pnpm --filter @queueplatform/notifications test` | SMS + dead-letter                                                            |
| `@queueplatform/loyalty`       | `pnpm --filter @queueplatform/loyalty test`       | Auth-store + middleware static guards                                        |
| `@queueplatform/e2e`           | `pnpm --filter @queueplatform/e2e test`           | Playwright: API health, loyalty login, integrations UI, a11y, portal offline |

### Loyalty coverage gate

```bash
pnpm audit:loyalty-coverage   # istanbul thresholds in vitest.loyalty.config.ts — ratchet as specs grow
```

### Loyalty DB golden-path (earn idempotency + external_id lookup)

```bash
export INTEGRATION_DATABASE_URL="postgresql://queueplatform:queueplatform@localhost:5432/queueplatform_test"
pnpm db:migrate:deploy
pnpm audit:loyalty-integration-db
```

Without `INTEGRATION_DATABASE_URL`, `loyalty-integration.integration.spec.ts` skips (expected locally).

## RLS integration (optional)

Requires Postgres with app role configured:

```bash
export INTEGRATION_DATABASE_URL="postgresql://qms_app:<password>@localhost:5432/queueplatform_test"
pnpm --filter @queueplatform/api test -- src/prisma/tenant-isolation.spec.ts
```

Without `INTEGRATION_DATABASE_URL`, the spec skips (expected locally).

## E2E locally

1. Migrate DB and start API on `:4000`, loyalty on `:3003`.
2. Run:

```bash
API_BASE_URL=http://localhost:4000 LOYALTY_BASE_URL=http://localhost:3003 \
  pnpm --filter @queueplatform/e2e test
```

Optional full login + integrations UI smoke (CI seeds a default user; override with secrets):

```bash
LOYALTY_SMOKE_EMAIL=... LOYALTY_SMOKE_PASSWORD=... \
  pnpm --filter @queueplatform/e2e test -- tests/loyalty-login.spec.ts tests/loyalty-integrations.spec.ts
```

**GitHub secrets (optional):** `LOYALTY_SMOKE_EMAIL`, `LOYALTY_SMOKE_PASSWORD` — when unset, CI uses `ci-loyalty-staff@queueplatform.test` / `CiLoyalty1!` via `scripts/seed-ci-loyalty-staff.mjs`.

## CI matrix (`.github/workflows/ci.yml`)

> **2026-06-29:** GitHub Actions is **disabled** for June (free minutes exhausted).
> Workflow preserved as `ci-patron-loyalty.yml.disabled`. Re-enable: `mv .github/workflows/ci-patron-loyalty.yml.disabled .github/workflows/ci.yml`
> Use local gates until then: `pnpm validate:ci && pnpm test && pnpm audit:loyalty-coverage`

| Job                        | Purpose                                                                |
| -------------------------- | ---------------------------------------------------------------------- |
| `validate`                 | `pnpm validate:ci` (lint, types, legal, security + architecture gates) |
| `lint-and-build`           | `pnpm build` + `check:bundle-budgets`                                  |
| `test-api`                 | migrate + `pnpm test` + loyalty coverage + DB golden-path spec         |
| `test-rls-policy`          | tenant isolation spec                                                  |
| `test-e2e-loyalty`         | API + loyalty Playwright (login + integrations stale-key UI)           |
| `test-notifications-smoke` | notifications package                                                  |
| `docker`                   | API image build on `main`                                              |

QMS-only jobs (`test-e2e-admin`, `test-e2e-realtime`, `apps/web`, `apps/admin`) are **not** run in this repo — see QlessQ sibling repo.

## Pre-release operator checklist

```bash
pnpm test:ci
pnpm --filter @queueplatform/e2e test    # with local servers or rely on CI job
pnpm audit:patron-loyalty                # Railway linked, prod smoke
pnpm audit:staging-soak                  # boundary curls (no Actions minutes)
```

**QlessQ split-deploy connector** (requires `LOYALTY_API_URL` + `LOYALTY_INTEGRATION_API_KEY`):

```bash
pnpm audit:loyalty-queue-events-smoke
```

**Prod API boundary smoke** (`API_DEPLOY_PROFILE=loyalty` on `pl-api`):

```bash
API=https://pl-api-production-a528.up.railway.app
curl -s -o /dev/null -w "health:%{http_code}\n" "$API/api/v1/health"          # 200
curl -s -o /dev/null -w "tickets:%{http_code}\n" "$API/api/v1/tickets"        # 404
curl -s -o /dev/null -w "queues:%{http_code}\n" "$API/api/v1/queues"          # 404
```

See also:

- [TEST_AUDIT_BASELINE.md](./TEST_AUDIT_BASELINE.md) — baseline inventory
- [PATRON_LOYALTY_AUDIT_REPORT.md](./PATRON_LOYALTY_AUDIT_REPORT.md) — latest audit output
- [FINAL_PRE_RELEASE_AUDIT.md](./FINAL_PRE_RELEASE_AUDIT.md) — legacy QMS checklist (partial applicability)
