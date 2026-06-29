# Environment & Deployment Guide

> **QMS sibling repo:** References to `apps/web` or `apps/admin` describe the **QlessQ** queue product in the sibling `../QMS` repository — not Patron Loyalty (`apps/loyalty`). See [REPO_BOUNDARIES.md](../architecture/REPO_BOUNDARIES.md).

---

## Environment Variables

### Never committed to git

`.env` files are gitignored. All secrets are managed via Railway dashboard or local `.env.local`.

### Local development

Create `packages/api/.env` for local development:

```env
# ─── Database ─────────────────────────────────────
DATABASE_URL="postgresql://postgres:password@localhost:5432/queueplatform"

# ─── Redis ────────────────────────────────────────
REDIS_URL="redis://localhost:6379"
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_PASSWORD=""

# ─── Auth ─────────────────────────────────────────
JWT_SECRET="<64+ random characters>"
JWT_REFRESH_SECRET="<64+ random characters>"
JWT_ACCESS_TTL=14400
JWT_REFRESH_TTL=604800

# ─── App ──────────────────────────────────────────
NODE_ENV="development"
SERVICE_TYPE="api"
APP_URL="http://localhost:3001"
API_URL="http://localhost:4000"

# ─── Centrifugo ───────────────────────────────────
CENTRIFUGO_API_URL="http://localhost:8000/api"
CENTRIFUGO_API_KEY="<from docker/centrifugo.json>"
CENTRIFUGO_SECRET="<from docker/centrifugo.json>"

# ─── Misc ─────────────────────────────────────────
ENCRYPTION_KEY="<32 random hex bytes>"
```

---

## Railway Production Variables (qms-api service)

These must be set in the Railway dashboard. Never in code.

| Variable                    | Notes                                                           |
| --------------------------- | --------------------------------------------------------------- |
| `DATABASE_URL`              | PostgreSQL internal URL                                         |
| `REDIS_URL`                 | Redis internal URL                                              |
| `REDIS_HOST`                | Used by BullMQ (internal hostname)                              |
| `REDIS_PASSWORD`            | BullMQ Redis password                                           |
| `REDIS_PORT`                | `6379`                                                          |
| `JWT_SECRET`                | ≥ 64 random chars                                               |
| `JWT_REFRESH_SECRET`        | ≥ 64 random chars                                               |
| `NODE_ENV`                  | `production`                                                    |
| `SERVICE_TYPE`              | `api`                                                           |
| `APP_URL`                   | Public web URL                                                  |
| `APP_ALLOWED_ORIGINS`       | Optional comma-separated extra frontend origins for API CORS    |
| `API_URL`                   | Public API URL                                                  |
| `CENTRIFUGO_API_URL`        | Internal Centrifugo URL                                         |
| `CENTRIFUGO_API_KEY`        | Centrifugo API key                                              |
| `CENTRIFUGO_SECRET`         | Centrifugo HMAC secret                                          |
| `CENTRIFUGO_WEBHOOK_SECRET` | Shared secret sent by Centrifugo webhook to `/realtime/webhook` |
| `ENCRYPTION_KEY`            | 64-char hex string                                              |
| `NIXPACKS_BUILD_CMD`        | See below                                                       |

### Production Observability & Sentry Integration

Sentry is fully integrated across the entire monorepo (API, Next.js Web, and Notifications worker) to capture unhandled exceptions with full request, tenant (orgId), and user context.

To enable tracking in production, set these variables on your Railway services:

| Variable                 | Notes                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| `SENTRY_DSN`             | Required for `packages/api` and `packages/notifications` to capture backend/worker exceptions. |
| `NEXT_PUBLIC_SENTRY_DSN` | Required for `apps/web` to capture frontend client-side and server-side exceptions.            |
| `SENTRY_ORG`             | Optional. Sentry Organization slug for source map uploads during build.                        |
| `SENTRY_PROJECT`         | Optional. Sentry Project slug for source map uploads during build.                             |
| `SENTRY_AUTH_TOKEN`      | Optional. Sentry Auth Token to upload source maps during build.                                |

Recommended enterprise additions:

| Variable                      | Notes                                           |
| ----------------------------- | ----------------------------------------------- |
| `LOG_LEVEL`                   | Keep production logging explicit and adjustable |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | If OpenTelemetry is adopted                     |
| `FEATURE_*` flags             | For staged rollout of risky behavior changes    |

### NIXPACKS_BUILD_CMD (critical — must include shared build)

```
pnpm install --frozen-lockfile && pnpm --filter @queueplatform/shared build && pnpm --filter @queueplatform/database db:generate && pnpm --filter @queueplatform/api build
```

---

## api.railway.json Required Fields

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "pnpm install --frozen-lockfile && pnpm --filter @queueplatform/shared build && pnpm --filter @queueplatform/database db:generate && pnpm --filter @queueplatform/api build",
    "watchPatterns": [
      "packages/api/**",
      "packages/shared/**",
      "packages/database/**",
      "railway/api.railway.json"
    ]
  },
  "deploy": {
    "numReplicas": 1,
    "startCommand": "sh scripts/railway-api-start.sh",
    "healthcheckPath": "/api/v1/health",
    "healthcheckTimeout": 60,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

**CRITICAL rules:**

- `startCommand` must stay deterministic and shell-light; production uses `sh scripts/railway-api-start.sh` (API only; migrations are a separate release step).
- Run migrations **before** deploy or scale-out: `bash scripts/railway-db-migrate.sh` (or Railway one-off job with the same command).
- Legacy single-replica only: set `RUN_DB_MIGRATIONS_ON_START=true` to run migrations inside the API start script (not safe with `numReplicas > 1`).
- `healthcheckPath` must be `/api/v1/health` (Docker image uses `/api/v1/health/live` — see `railway/api.railway.json`).
- `healthcheckTimeout` must be ≥ 60

### Database migration release step (required)

```bash
# From repo root on Railway one-off / CI deploy job:
bash scripts/railway-db-migrate.sh
```

Then deploy or restart API replicas. Do not run `db:migrate:deploy` concurrently across multiple replicas.

### CSP staged rollout

| Variable            | Purpose                                                             |
| ------------------- | ------------------------------------------------------------------- |
| `CSP_STRICT_MODE=1` | Enforce `script-src 'self'` without `'unsafe-inline'` on web/admin  |
| `CSP_REPORT_ONLY=1` | Emit `Content-Security-Policy-Report-Only` for staging verification |

Enable strict mode in staging first; fix violations; then enforce in production.

### SMS message packs (one-time Stripe checkout)

Customers can buy additional lifetime SMS messages when their allowance is used up (Billing → **Buy SMS messages**).

1. Set `STRIPE_SECRET_KEY` (and webhook secret) on the API — the billing UI enables **Purchase** buttons as soon as Stripe is connected.
2. _(Optional but recommended)_ In Stripe Dashboard, create three **one-time** Prices and set on `qms-api`:

| Variable                 | Example pack    |
| ------------------------ | --------------- |
| `STRIPE_PRICE_SMS_500`   | 500 messages    |
| `STRIPE_PRICE_SMS_2000`  | 2,000 messages  |
| `STRIPE_PRICE_SMS_10000` | 10,000 messages |

Without Price IDs, checkout still works using dynamic `price_data` from defaults in `packages/shared/src/constants/sms-credit-packs.ts`.

Optional overrides: `SMS_PACK_SMS_500`, `SMS_CREDITS_*` (plan base allowance).

3. Ensure the Stripe webhook endpoint receives `checkout.session.completed` (same secret as subscriptions).
4. Run migration `20260521120000_add_sms_credit_purchases` before enabling in production.

## CI, Docker images, and recurring deploy failures

See **[DEPLOYMENT_CI_AND_DOCKER.md](./DEPLOYMENT_CI_AND_DOCKER.md)** for why CI can pass while Railway/GHCR still fails, the pre-push checklist, and the `pnpm check:docker-build-context` guard.

---

## Production readiness expectations

- Keep deploy commands deterministic and easy to reason about from logs.
- Make schema changes backward compatible before deploying code that depends on them whenever possible.
- Prefer staged rollout or feature flags for high-risk behavior changes.
- Ensure critical dependencies are represented in monitoring, not just the web process.
- Verify backup, restore, and rollback expectations before major releases.

## Minimum incident discipline

- Record the root cause, customer impact, and prevention action for every production incident.
- Remove temporary debug code and debug environment overrides after the incident is resolved.
- If a deploy failure revealed a missing guardrail, update [STANDARDS.md](../STANDARDS.md) or this guide.

---

## Local Development

```bash
# Start infrastructure (Postgres, Redis, Centrifugo)
pnpm docker:up

# Start all services
pnpm dev

# API runs on :4000
# Web runs on :3001
# Centrifugo on :8000
```

---

## Build Commands Reference

```bash
# Full build (same as Railway)
pnpm install --frozen-lockfile && pnpm --filter @queueplatform/shared build && pnpm --filter @queueplatform/database db:generate && pnpm --filter @queueplatform/api build

# Database operations
pnpm --filter @queueplatform/database db:migrate   # run migrations
pnpm --filter @queueplatform/database db:generate  # regenerate Prisma client
pnpm --filter @queueplatform/database db:seed      # seed dev data
pnpm --filter @queueplatform/database db:studio    # open Prisma Studio

# Tests
pnpm --filter @queueplatform/api test
pnpm --filter @queueplatform/shared test

# Lint
pnpm --filter @queueplatform/api lint
```

## Operational hardening backlog

Recommended next improvements for enterprise-grade readiness:

1. Centralized structured logging and correlation IDs across API and workers
2. Metrics and alerting for API latency, queue depth, job failures, and Redis/Postgres health
3. Explicit runbooks for deploy failure, migration failure, and notification backlog incidents
4. Feature-flag or staged rollout support for high-risk changes
5. Backup and restore drills documented and tested
