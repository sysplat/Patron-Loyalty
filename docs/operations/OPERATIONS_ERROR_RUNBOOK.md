# Operations error runbook

Quick reference for on-call and platform admins when customers report API or UI failures.

## Incident runbooks (Patron Loyalty)

| Scenario             | Doc                                                                    |
| -------------------- | ---------------------------------------------------------------------- |
| Staff auth outage    | [incidents/LOYALTY_AUTH_OUTAGE.md](./incidents/LOYALTY_AUTH_OUTAGE.md) |
| Connector 4xx spike  | [incidents/CONNECTOR_4XX_SPIKE.md](./incidents/CONNECTOR_4XX_SPIKE.md) |
| Migration failure    | [incidents/MIGRATION_FAILURE.md](./incidents/MIGRATION_FAILURE.md)     |
| Redis down           | [incidents/REDIS_DOWN.md](./incidents/REDIS_DOWN.md)                   |
| QlessQ connector ops | [QLESSQ_CONNECTOR_OPS.md](./QLESSQ_CONNECTOR_OPS.md)                   |

Legacy QMS-wide notes remain in sections below where still applicable (`qms-api` naming).

1. Ask for the **time (UTC)**, **organization**, and any **reference code** shown in the error toast.
2. In API logs (Railway → `qms-api` → Logs), search for `requestId` or the short reference (first 8 characters of `X-Request-ID`).
3. In Sentry (when `SENTRY_DSN` is set), filter by tag `requestId` or release (`RAILWAY_GIT_COMMIT_SHA` / `SENTRY_RELEASE`).

Error JSON shape from the API:

```json
{
  "success": false,
  "error": { "code": "NOT_FOUND", "message": "..." },
  "requestId": "uuid"
}
```

## Health endpoints

| Endpoint                  | Purpose                                          |
| ------------------------- | ------------------------------------------------ |
| `GET /api/v1/health/live` | Liveness (no DB/Redis) — Railway API healthcheck |
| `GET /api/v1/health`      | Readiness (DB + Redis)                           |
| `GET /api/v1/health/meta` | Release, environment, Sentry enabled flag        |
| `GET /api/health` (web)   | Next.js liveness — Railway web healthcheck       |

## Common status codes

| Status            | Meaning                     | Action                                                   |
| ----------------- | --------------------------- | -------------------------------------------------------- |
| 401               | Session expired             | User re-login; check JWT secrets unchanged across deploy |
| 403               | RBAC / plan limit           | Verify role and billing plan                             |
| 404 + `NOT_FOUND` | Missing resource            | Data or wrong ID; not a routing bug                      |
| 404 (HTML/nginx)  | Wrong host or stale deploy  | Confirm `NEXT_PUBLIC_API_URL` ends with `/api/v1`        |
| 409               | Conflict (e.g. desk in use) | Expected; user refreshes queue                           |
| 429               | Rate limit                  | Retry; check abuse or quota                              |
| 5xx               | Server error                | Sentry + logs; check DB/Redis connectivity               |

## Sentry verification

- **Local**: `GET http://localhost:4000/api/v1/health/sentry-test` (throws intentionally).
- **Production**: set `SENTRY_TEST_SECRET`, then  
  `curl -H "x-sentry-test-secret: $SECRET" https://<api>/api/v1/health/sentry-test`

## Notifications worker

- Failed jobs retry up to **3** attempts (API enqueue default).
- After exhaustion, payload is copied to BullMQ queue **`notifications-dead`**.
- Inspect Redis / Bull Board if installed; fix provider credentials (Twilio/SendGrid) and re-queue manually if needed.

## Railway environment (production)

Set on **qms-api**, **qms-web**, and **qms-notifications**:

- `SENTRY_DSN` — API and worker server-side capture
- `NEXT_PUBLIC_SENTRY_DSN` — web client (build-time on web service)
- Optional: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` — source maps on web build
- Optional: `SENTRY_TEST_SECRET` — guarded prod Sentry test route
- Release is auto-derived from `RAILWAY_GIT_COMMIT_SHA` when `SENTRY_RELEASE` is unset

Redeploy all three services after changing DSN or public env vars.

## Admin UI

**Infrastructure** in the platform admin app shows tenant health snapshots and live platform `/health` / `/health/meta` probes.
