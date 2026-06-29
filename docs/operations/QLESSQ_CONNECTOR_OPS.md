# QlessQ connector — LMS ops runbook

Patron Loyalty ingests normalized queue events at `POST /api/v1/loyalty/integrations/v1/queue-events` (API key: `X-Loyalty-Api-Key`).

## Structured logs

Search Railway / log drain for:

| Log `type`                    | Meaning                                                     |
| ----------------------------- | ----------------------------------------------------------- |
| `loyalty_connector_ingest`    | Successful ingest attempt (includes latency + outcome)      |
| `loyalty_connector_4xx_spike` | ≥10 client errors (4xx) from same org + route within 1 hour |

Example ingest line:

```json
{
  "type": "loyalty_connector_ingest",
  "orgId": "...",
  "route": "queue-events",
  "event": "ticket.completed",
  "sourceId": "ticket-123",
  "connectorVersion": 1,
  "durationMs": 42,
  "outcome": "ok",
  "idempotent": false
}
```

**Outcomes:** `ok` · `idempotent` · `skipped` · `validation_error` · `error`

## Deploy verification

```bash
API=https://pl-api-production-a528.up.railway.app
curl -sS "$API/api/v1/health/meta" | jq .
curl -sS -o /dev/null -w "%{http_code}\n" "$API/api/v1/health"
curl -sS -o /dev/null -w "%{http_code}\n" "$API/api/v1/tickets"
curl -sS -o /dev/null -w "%{http_code}\n" "$API/api/v1/queues"
curl -sS -o /dev/null -w "%{http_code}\n" -X POST "$API/api/v1/loyalty/integrations/v1/queue-events" \
  -H "Content-Type: application/json" -d '{}'
```

Expected on loyalty deploy: health **200**, tickets/queues **404**, queue-events **401**.

Confirm `release` in `/api/v1/health/meta` matches the deployed git SHA.

## 4xx spike response

When `loyalty_connector_4xx_spike` fires:

1. Identify org (`orgId`) and route (usually `queue-events`).
2. Check recent QlessQ connector config (`apiBaseUrl`, rotated API key).
3. Replay a single event with curl + valid key; confirm 200 vs 400 validation error.
4. If key rotation mismatch: regenerate LMS integration key in staff UI, update QlessQ `integrations.config.apiKey`.
5. Optional: Redis key `loyalty:connector:4xx:{orgId}:{route}` (TTL 1h).

## Connector version

Payload field `connectorVersion` (default **1**) allows schema evolution without breaking older QlessQ forwarders.

## QlessQ sibling responsibilities

- Retry POST with exponential backoff on 5xx / network errors.
- Treat `{ idempotent: true }` as success (no re-earn).
- Do not retry 4xx except 429 (rate limit).

## Sentry release tags

API Sentry and `/api/v1/health/meta` use `getObservabilityRelease()`:

1. `SENTRY_RELEASE` (explicit — preferred for Sentry ↔ deploy correlation)
2. `RAILWAY_GIT_COMMIT_SHA` (Railway injects this automatically)
3. `VERCEL_GIT_COMMIT_SHA` / `development`

**Railway `pl-api` (when CLI quota allows or via Railway UI → Variables):**

```bash
# Optional explicit tag; otherwise RAILWAY_GIT_COMMIT_SHA is used automatically
SENTRY_RELEASE=${{RAILWAY_GIT_COMMIT_SHA}}
```

Requires `SENTRY_DSN` on the same service. After deploy, confirm `/api/v1/health/meta` `release` matches the deployed commit prefix.

**Railway UI checklist (pl-api → Variables → Redeploy):**

| Variable         | Value                                       |
| ---------------- | ------------------------------------------- |
| `SENTRY_DSN`     | Sentry project DSN (Settings → Client Keys) |
| `SENTRY_RELEASE` | `${{RAILWAY_GIT_COMMIT_SHA}}`               |

Verify: `curl -sS $API/api/v1/health/meta | jq '{release, sentryEnabled}'` — expect `sentryEnabled: true`.
