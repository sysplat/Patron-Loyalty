# QlessQ ↔ Patron Loyalty integration

Patron Loyalty (this repo) and QlessQ (sibling `../QMS`) are **separate products** that can run independently or together.

## When both are licensed

```text
┌──────────────────┐   HTTP webhooks / Integration API   ┌─────────────────────┐
│  QlessQ          │ ───────────────────────────────────► │  Patron Loyalty     │
│  ticket.completed│   patron id, branch, service, time   │  earn points        │
│  appointment.*   │                                      │  segments, campaigns│
│  review.created  │                                      │  churn / no-show    │
└──────────────────┘                                      └─────────────────────┘
```

### QlessQ → LMS (inbound to LMS)

| Mechanism                                 | Use                                                                                                             |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Integration API** (`X-Loyalty-Api-Key`) | QlessQ (or a connector worker) calls LMS: `POST /loyalty/integrations/v1/points/earn`, `customers/upsert`, etc. |
| **Shared database** (transition only)     | Both apps pointed at same Postgres + RLS — simplest during migration; prefer API/events long term.              |
| **Tenant linking**                        | Map `qlessqOrgId` ↔ `lmsOrgId` in admin or env when org buys bundle.                                            |

### LMS → external systems (outbound)

| Mechanism                    | Use                                                                     |
| ---------------------------- | ----------------------------------------------------------------------- |
| **`LOYALTY_WEBHOOK_EVENTS`** | Tenant-configured webhooks: points earned, tier upgraded, no-show, etc. |
| **Integration API**          | POS/e-commerce calls LMS directly (no QlessQ required).                 |

## Event payload (recommended contract)

QlessQ should send normalized events; LMS idempotency key = `sourceType` + `sourceId`:

```json
{
  "event": "loyalty.visit.completed",
  "orgId": "…",
  "customerId": "…",
  "sourceType": "ticket",
  "sourceId": "ticket-uuid",
  "branchId": "…",
  "serviceId": "…",
  "occurredAt": "2026-06-17T20:00:00.000Z"
}
```

Map to Integration API earn call or internal `earnFromEvent` handler.

## Loyalty-only tenants

No QlessQ connection required. Patron data from:

- Staff entry in `apps/loyalty`
- Patron portal self-serve profile
- `POST /loyalty/integrations/v1/*` (POS, e-commerce)
- CSV/import (future)

## Environment (LMS)

```bash
# Optional: QlessQ API base when LMS calls back (future connector UI)
QLESSQ_INTEGRATION_URL=https://api.qlessq.example
QLESSQ_INTEGRATION_API_KEY=
```

## Environment (QlessQ)

```bash
# When QlessQ forwards events to a separate LMS deploy
LOYALTY_INTEGRATION_URL=https://api.loyalty.example
LOYALTY_INTEGRATION_API_KEY=
```

## Code locations (this repo)

- API: `packages/api/src/modules/loyalty/`
- Integration controller: `loyalty-integration.controller.ts`
- Webhook emitter: `loyalty-webhook.service.ts`
- Constants: `packages/shared/src/constants/loyalty.ts` (`LOYALTY_WEBHOOK_EVENTS`, earn event types)

## Code locations (QlessQ sibling)

- Event emitters: `ticket-transition.service.ts`, `appointment-lifecycle.service.ts`
- Listener (same-DB monolith mode): `packages/api/src/modules/loyalty/loyalty.listener.ts`

When QlessQ and LMS deploy separately, replace in-process listener with an HTTP forwarder to LMS Integration API.
