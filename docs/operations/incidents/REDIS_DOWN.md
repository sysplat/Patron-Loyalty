# Redis unavailable (Patron Loyalty)

**Symptoms:** `/api/v1/health` not 200; connector 4xx counters skipped; BullMQ jobs stall; session refresh flaky.

## Triage (5 min)

1. `curl -sS "$API/api/v1/health"` — readiness includes Redis.
2. Railway → Redis plugin / `REDIS_URL` on pl-api.
3. Logs: `ECONNREFUSED`, `Redis`, `BullMQ`.

## Impact

| Feature                     | Degraded behavior                                |
| --------------------------- | ------------------------------------------------ |
| Connector 4xx spike counter | Best-effort skip (ingest still works)            |
| BullMQ workers              | Notifications / async jobs queue or fail         |
| Rate limits / locks         | May fail open or closed — check throttler config |

## Recovery

1. Restore Redis service or fix `REDIS_URL`.
2. Redeploy pl-api if connection pool stuck.
3. Inspect `notifications-dead` queue after prolonged outage.

## Verification

```bash
curl -sS "$API/api/v1/health"
pnpm --filter @queueplatform/notifications test   # local smoke
```
