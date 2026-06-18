# Railway Deployment Configs

This folder contains Railway configuration files for each deployable service in the monorepo.

## Services

| File                          | Service                    | Runtime                                                                       |
| ----------------------------- | -------------------------- | ----------------------------------------------------------------------------- |
| `api.railway.json`            | NestJS REST API            | Docker ([`docker/api.Dockerfile`](docker/api.Dockerfile))                     |
| `web.railway.json`            | Next.js Web App            | Docker ([`docker/web.Dockerfile`](docker/web.Dockerfile))                     |
| `loyalty.railway.json`        | Loyalty staff app          | Docker ([`docker/loyalty.Dockerfile`](docker/loyalty.Dockerfile))             |
| `notifications.railway.json`  | BullMQ Notification Worker | Docker ([`docker/notifications.Dockerfile`](docker/notifications.Dockerfile)) |
| `../railway.json` (repo root) | Admin Next app             | Docker ([`docker/admin.Dockerfile`](docker/admin.Dockerfile))                 |

## Troubleshooting: API healthcheck / crash loop

If **`qms-api`** never passes healthcheck and deploy logs show:

```text
EXPOSE_INVITE_TOKENS cannot be enabled in production
```

the API **refuses to start** (`packages/api/src/main.ts` boot validation). Fix in Railway → **qms-api** → **Variables**:

1. Set **`EXPOSE_INVITE_TOKENS=false`**, or
2. **Delete** the variable entirely (unset = allowed).

`EXPOSE_INVITE_TOKENS=true` is only for **temporary** RBAC smoke runs against a non-production API. Never leave it enabled on production — the process exits before binding to the port, so `/api/v1/health/live` never responds.

## Setup Instructions

### 1. Install Railway CLI

```bash
npm install -g @railway/cli
railway login
```

### 2. Create a new Railway project

```bash
railway new
```

### 3. Add each service

In the Railway dashboard, add each service from the same GitHub repository and set the **Config File Path** to the corresponding file in this folder:

| Service              | Config File Path                     |
| -------------------- | ------------------------------------ |
| API                  | `railway/api.railway.json`           |
| Web                  | `railway/web.railway.json`           |
| Loyalty              | `railway/loyalty.railway.json`       |
| Admin                | `railway.json` (repository root)     |
| Notifications Worker | `railway/notifications.railway.json` |

### 4. Add required infrastructure

Add the following Railway plugins/services to your project:

- **PostgreSQL** — for the main database
- **Redis** — for caching, sessions, and BullMQ queues

### 5. Set environment variables

For each service, configure the required environment variables from `.env.example`.

**API service:**

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
JWT_SECRET=<random 64-char secret>
CENTRIFUGO_API_KEY=<your centrifugo api key>
CENTRIFUGO_API_URL=<your centrifugo instance URL>
```

Optional ticketing SMS tuning on the API (default 3; max 3 “almost ready” SMS per call; see README):

```
TICKET_ALMOST_READY_POSITION=3
```

**Web service** (set before build; Next inlines `NEXT_PUBLIC_*` at compile time):

Use the API host with `/api/v1` (recommended), or the host only — the web app appends `/api/v1` when missing.

```
NEXT_PUBLIC_API_URL=<your API Railway URL>/api/v1
NEXT_PUBLIC_CENTRIFUGO_WS_URL=wss://<centrifugo-public-host>/connection/websocket
NEXT_PUBLIC_CENTRIFUGO_URL=wss://<centrifugo-public-host>/connection/websocket
NEXT_PUBLIC_ADMIN_URL=https://<your-admin-host>
NEXT_PUBLIC_LOYALTY_URL=https://<your-loyalty-host>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<optional>
```

**Loyalty service** (same build-time rule for `NEXT_PUBLIC_*`):

```
NEXT_PUBLIC_API_URL=<your API Railway URL>/api/v1
NEXT_PUBLIC_CENTRIFUGO_WS_URL=wss://<centrifugo-public-host>/connection/websocket
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<optional>
```

Add the loyalty public host to **qms-api** `APP_ALLOWED_ORIGINS` (comma-separated with web + admin).

**Admin service** (same build-time rule for `NEXT_PUBLIC_*`):

```
NEXT_PUBLIC_API_URL=<your API Railway URL>/api/v1
NEXT_PUBLIC_CENTRIFUGO_WS_URL=wss://<centrifugo-public-host>/connection/websocket
NEXT_PUBLIC_WEB_URL=https://<your-web-host>
NEXT_PUBLIC_LOYALTY_URL=https://<your-loyalty-host>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<optional>
```

**Notifications worker:**

Production email uses **Twilio SendGrid** (same family as Twilio SMS). Create a SendGrid API key
(`SG.xxx`) and a verified sender at [sendgrid.com](https://sendgrid.com), then set:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
TWILIO_SENDGRID_API_KEY=SG.<your-sendgrid-api-key>
TWILIO_SENDGRID_FROM_EMAIL=noreply@yourdomain.com
EMAIL_FROM=noreply@yourdomain.com
```

> **Note:** `TWILIO_SENDGRID_API_KEY` is a SendGrid-specific key (starts with `SG.`).
> It is **not** the same as `TWILIO_AUTH_TOKEN` or `TWILIO_API_KEY` used for SMS.

When `TWILIO_SENDGRID_API_KEY` is set, the notifications worker sends mail through SendGrid’s **HTTPS API**
(`api.sendgrid.com`), not SMTP port 587, so cloud egress timeouts to `smtp.sendgrid.net` are avoided.
You do **not** need to set `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` for SendGrid.

**SMS (same worker):** enqueue jobs from the API use the worker’s SMS stack. Mirror the Twilio variables from the root [.env.example](../.env.example):

```
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=            # optional if using API Key + Secret
TWILIO_API_KEY=SK...
TWILIO_API_SECRET=...
TWILIO_PHONE_NUMBER=+1...
TWILIO_STATUS_CALLBACK_URL=https://<your-api-host>/api/v1/notifications/webhook/twilio-status
```

`qms-api` should also expose `TWILIO_*` when you use SMS-related features outside the worker (callbacks, previews). **`qms-notifications` must have the sending credentials** above or SMS jobs fail at delivery time.

If you use a different SMTP relay instead, omit the SendGrid vars and set:

```
SMTP_HOST=<relay host>
SMTP_PORT=587
SMTP_USER=<relay user>
SMTP_PASS=<relay password>
EMAIL_FROM=noreply@yourdomain.com
```

### 6. Run database migrations

After deploying the API service, run from your local machine:

```bash
railway run --service api pnpm db:push
railway run --service api pnpm db:seed
```

If **`qms-api`** fails on `prisma migrate deploy` with **P3009** / **P3018** (failed migration or column already exists), recent API images run `scripts/migrate-deploy.sh`, which clears known failed rows then redeploys idempotent SQL. **Redeploy the latest `main` image** — no manual step needed in most cases.

Manual recovery (only if an old image is still running):

```bash
railway run --service qms-api pnpm --filter @queueplatform/database db:migrate:recover-flow-failed
railway run --service qms-api pnpm --filter @queueplatform/database db:migrate:deploy
```

Known idempotent migrations: `20260506120000_admin_two_factor`, `20260516113000_add_flow_templates_and_ready_policies`.

## Centrifugo

Centrifugo is not included as a Railway plugin. Deploy it from this repo using [`railway/centrifugo.railway.json`](centrifugo.railway.json) (Dockerfile [`apps/centrifugo/Dockerfile`](../apps/centrifugo/Dockerfile), **Centrifugo v6** config in [`docker/centrifugo.json`](../docker/centrifugo.json)).

The bundled JSON uses `engine.redis.address` `redis://redis:6379` for local Docker Compose. **On Railway**, link the **Redis** plugin to the Centrifugo service so **`REDIS_URL`** (or **`REDIS_PRIVATE_URL`**) is injected. The image [`centrifugo-entrypoint.sh`](../docker/centrifugo-entrypoint.sh) maps that to **`CENTRIFUGO_ENGINE_REDIS_ADDRESS`** (Centrifugo **v6** single-underscore env convention).

Also set on the Centrifugo service (same values as **qms-api**):

- **`CENTRIFUGO_SECRET`** → JWT HMAC secret (`CENTRIFUGO_CLIENT_TOKEN_HMAC_SECRET_KEY` at runtime)
- **`CENTRIFUGO_API_KEY`** → HTTP API key (`CENTRIFUGO_HTTP_API_KEY` at runtime)

Legacy v5 names like `CENTRIFUGO_TOKEN_HMAC_SECRET_KEY` or double-underscore keys like `CENTRIFUGO_ENGINE__REDIS__ADDRESS` are **ignored** by Centrifugo v6 and will appear as “unknown var” warnings in logs.

The container listens on **`PORT`** (Railway injects it).

**Public URL for browsers**

1. Expose HTTP on your chosen listen port (commonly **8000** to match local dev).
2. In Railway → Centrifugo service → **Networking** → **Generate Domain** to get `https://<name>.up.railway.app`.
3. Ensure **HTTPS** terminates at Railway so the UI can connect with **`wss://`**:
   - `NEXT_PUBLIC_CENTRIFUGO_WS_URL=wss://<host>/connection/websocket`
   - `NEXT_PUBLIC_CENTRIFUGO_URL` often matches `NEXT_PUBLIC_CENTRIFUGO_WS_URL` for this codebase.
4. Redeploy `qms-web` after changing either variable (Next.js bakes them in at build time).

**Operational checks**

- `GET https://<centrifugo-host>/health` should return `{}` with HTTP 200.
- Plain `curl` to `/connection/websocket` returning **400 Bad Request** is normal (browser WebSocket Upgrade is required).

**Realtime webhook (required in production)**

API boot fails without `CENTRIFUGO_WEBHOOK_SECRET`. Centrifugo must proxy connect/subscribe events to `POST /api/v1/realtime/webhook` with header `x-centrifugo-webhook-secret`. See [`docs/deployment/OPS_GATE_REALTIME.md`](../docs/deployment/OPS_GATE_REALTIME.md).

Verify after deploy:

```bash
API_BASE=https://<qms-api-host>/api/v1 pnpm check:ops-gates
```

Local dev uses `centrifugo.local.json` (v5 CLI) with `proxy_http_url`. Railway Centrifugo v6 must mirror that proxy wiring — see ops doc before sign-off.

## Pre-release ops gates

| Gate                  | Doc / command                                                                                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Serve-surface audit   | [`docs/qa/SERVE_SURFACE_MIGRATION_RUNBOOK.md`](../docs/qa/SERVE_SURFACE_MIGRATION_RUNBOOK.md) → `pnpm --filter @queueplatform/database audit:serve-surface` |
| SMS/email smoke       | [`docs/operations/FINAL_PRE_RELEASE_AUDIT.md`](../docs/operations/FINAL_PRE_RELEASE_AUDIT.md) §4 → `pnpm smoke:rbac-e2e`                                    |
| Realtime webhook      | [`docs/deployment/OPS_GATE_REALTIME.md`](../docs/deployment/OPS_GATE_REALTIME.md) → `pnpm check:ops-gates`                                                  |
| CSP strict (optional) | [`docs/deployment/DEPLOYMENT_GUIDE.md`](../docs/deployment/DEPLOYMENT_GUIDE.md) — staging `CSP_REPORT_ONLY=1` then `CSP_STRICT_MODE=1`                      |

## Build times (Docker on Railway)

API, web, notifications, and admin build with **Dockerfiles** under [`railway/docker/`](docker/) (repository root as build context). **API** and **notifications** use slim workspace manifests (`pnpm-workspace.api.yaml` / `pnpm-workspace.notifications.yaml`) and `pnpm install --filter "…"` so Next.js (`@next/swc-*`) is never installed in those images — avoids Railway builder **no space left on device** errors.

**BuildKit cache mounts:** Railway’s builder validates cache mount `id` values and expects a **service-scoped prefix** (see [Railway Dockerfiles](https://docs.railway.app/builds/dockerfiles)). A single shared `id=qms-pnpm` across services is rejected (`cacheKey prefix` / `dockerfile invalid`). This repo therefore **does not** use `RUN --mount=type=cache,...` in those Dockerfiles so deploys succeed in any project. For a private fork you can add per-service mounts with `id=s/<your-service-uuid>-/pnpm/store` if you want layer caching.

Cold builds are still dominated by compile work (Nest, Next, Prisma) and snapshot size; **watchPatterns** in each `*.railway.json` limit redeploys, and [`.dockerignore`](../.dockerignore) trims the Docker build context.

**Next.js standalone (`qms-web`, `qms-admin`):** keep **`deploy.startCommand`** as `node apps/<app>/server.js`. If it is omitted, Railway may run `pnpm … start` / `next start`, which fails in the slim standalone image (`next: not found`).

## Operations (logs and delivery)

| Area             | Where to look                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Builds / crashes | Railway → service → **Deployments** and **Logs**                                                                                                                                                                                                                                                                                                                                                                                                               |
| Email / SMS jobs | BullMQ queue `notifications` — worker logs (`Email delivery configuration` on startup = `sendgrid-https` vs `smtp`; on failure look for `Provider returned failure` with SendGrid JSON). [SendGrid Activity](https://app.sendgrid.com/email_activity) for suppressions/bounces; **from** address must match a [verified sender](https://app.sendgrid.com/settings/sender_auth) (trial accounts often only allow mail to addresses you’ve explicitly verified). |
| SMS delivery     | Twilio Console → Monitor → Logs & Messaging                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Realtime bugs    | Wrong or missing Centrifugo public URL on `qms-web`; Centrifugo service sleeping → redeploy/wake                                                                                                                                                                                                                                                                                                                                                               |

Do **not** commit API tokens or SendGrid/Twilio secrets; keep them in Railway variables only so they never enter git history.

### RBAC / email / SMS smoke (full stack)

Repo script (from your machine):

```bash
API_BASE=https://<your-qms-api-host>/api/v1 \\
  EXPOSE_INVITE_TOKENS=true \\
  SMS_TEST_NUMBER=<E.164> \\
  SMOKE_EMAIL_TO=<your-inbox@example.com> \\
  pnpm smoke:rbac-e2e
```

- **`EXPOSE_INVITE_TOKENS=true`** on **`qms-api` only**, **temporarily**, so each `POST /users/invite` response includes `inviteToken` (otherwise production cannot automate multi-role JWT tests without reading email). **Remove the variable or set it to `false` immediately after the run** — production boot validation rejects `true` and the API will not start.
- **`SMS_TEST_NUMBER` / `SMOKE_EMAIL_TO`** exercise Twilio SendGrid-backed paths via the notifications worker (`POST /notifications/test-sms` and `POST /notifications/send`).
- The script waits out cold-start **503** responses on `/health` (Railway sleep).
