# Connector 4xx spike (QlessQ → LMS)

**Symptoms:** `loyalty_connector_4xx_spike` in pl-api logs; QlessQ reports failed loyalty writes; staff see stale API key on `/integrations`.

## Triage (5 min)

1. Log drain: search `"type":"loyalty_connector_4xx_spike"` — note `orgId`, `route`, `count`.
2. Staff UI → **Integrations** → check **Last used** and stale-key hint.
3. Single replay:

```bash
curl -sS -X POST "$API/api/v1/loyalty/integrations/v1/queue-events" \
  -H "X-Loyalty-Api-Key: $LOYALTY_INTEGRATION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"event":"ticket.completed","sourceId":"probe-1","customer":{"externalId":"probe-cust","name":"Probe"}}'
```

## Common causes

| Cause                                     | Fix                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------- |
| Rotated LMS key, QlessQ still has old key | Update QlessQ `integrations.config.apiKey`; verify **Last used** updates        |
| Validation error (bad payload)            | Compare payload to `@queueplatform/shared` Zod schemas; fix connector forwarder |
| Wrong org key (multi-tenant)              | Confirm QlessQ `lmsOrgId` matches LMS org                                       |
| Patron CRM disabled                       | Enable `patronCrmEnabled` on org                                                |

## Redis counter (optional)

Key: `loyalty:connector:4xx:{orgId}:{route}` — TTL 1 hour. High count confirms sustained bad traffic.

## Recovery verification

```bash
pnpm audit:loyalty-queue-events-smoke   # needs LOYALTY_API_URL + LOYALTY_INTEGRATION_API_KEY
```

See [QLESSQ_CONNECTOR_OPS.md](../QLESSQ_CONNECTOR_OPS.md).
