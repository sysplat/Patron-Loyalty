# QlessQ ↔ Patron Loyalty integration

Patron Loyalty (this repo) and QlessQ (sibling `../QMS`) are **separate products** that can run independently or together.

## When both are licensed

```text
┌──────────────────┐   POST /loyalty/integrations/v1/queue-events   ┌─────────────────────┐
│  QlessQ API      │   X-Loyalty-Api-Key + normalized payload      │  Patron Loyalty API │
│  ticket.completed│ ────────────────────────────────────────────► │  earn points        │
│  appointment.*   │                                               │  segments, campaigns│
│  review.created  │                                               │  churn / no-show    │
└──────────────────┘                                               └─────────────────────┘
```

### QlessQ → LMS (inbound to LMS)

| Mechanism                                        | Use                                                                                                |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| **`POST /loyalty/integrations/v1/queue-events`** | Primary path when QlessQ and LMS deploy separately. QlessQ HTTP forwarder sends normalized events. |
| **Integration API** (`X-Loyalty-Api-Key`)        | POS/e-commerce: `points/earn`, `customers/upsert`, coupons, wallet.                                |
| **In-process listener**                          | Same monorepo + shared Postgres: `loyalty.listener.ts` handles events locally (no HTTP).           |
| **Tenant linking**                               | QlessQ org stores `integrations` row `type: patron_loyalty` with LMS API URL + key.                |

### LMS → external systems (outbound)

| Mechanism                    | Use                                                                     |
| ---------------------------- | ----------------------------------------------------------------------- |
| **`LOYALTY_WEBHOOK_EVENTS`** | Tenant-configured webhooks: points earned, tier upgraded, no-show, etc. |
| **Integration API**          | POS/e-commerce calls LMS directly (no QlessQ required).                 |

## Tenant linking (bundle)

On **QlessQ**, staff with CRM permissions configure the forwarder:

```http
GET  /api/v1/loyalty/connector
POST /api/v1/loyalty/connector
POST /api/v1/loyalty/connector/disconnect
```

Body for `POST /loyalty/connector`:

```json
{
  "lmsOrgId": "optional-lms-org-uuid",
  "apiBaseUrl": "https://pl-api-production.example.com/api/v1",
  "apiKey": "loyalty_live_..."
}
```

Stored as `integrations.type = patron_loyalty`. When linked:

- QlessQ **skips** in-process `LoyaltyListener` for that org.
- `LoyaltyConnectorListener` **forwards** events to LMS `queue-events`.

On **LMS**, generate the API key under **Integrations** (`/integrations` in the staff app). The key scopes all Integration API calls (including `queue-events`) to the LMS org.

### Customer identity across deploys

QlessQ sends `customer.externalId` = QlessQ `Customer.id`. LMS upserts patrons by `externalId` in customer metadata so IDs can differ per database.

## Queue event payload

```json
{
  "event": "ticket.completed",
  "sourceId": "ticket-uuid",
  "branchId": "branch-uuid",
  "serviceId": "service-uuid",
  "customer": {
    "externalId": "qlessq-customer-uuid",
    "name": "Jane Patron",
    "email": "jane@example.com",
    "phone": "+15551234567"
  },
  "occurredAt": "2026-06-17T20:00:00.000Z"
}
```

| `event`                 | LMS action                                |
| ----------------------- | ----------------------------------------- |
| `ticket.completed`      | Earn visit points, increment challenges   |
| `ticket.no_show`        | Churn risk + win-back trigger             |
| `appointment.completed` | Earn appointment points                   |
| `appointment.no_show`   | Churn risk + win-back trigger             |
| `review.submitted`      | Review bonus points                       |
| `customer.created`      | Ensure loyalty account + welcome campaign |

Idempotency: earn ledger dedupes on `(orgId, accountId, sourceType, sourceId)` for `earn` / `bonus` rows. QlessQ connector retries and duplicate `queue-events` deliveries return `{ ok: true, idempotent: true }` without re-awarding points, incrementing visits, or firing gamification side effects. Enforced in application code and by partial unique index `loyalty_point_ledger_earn_source_idempotent_idx`.

### Connector verification (LMS)

```bash
# Requires LOYALTY_API_URL and LOYALTY_INTEGRATION_API_KEY in .env / .env.local
pnpm audit:loyalty-queue-events-smoke
```

Sends a synthetic `ticket.completed`, asserts `{ ok: true }`, then retries the same `sourceId` and asserts `{ idempotent: true }`.

## Loyalty-only tenants

No QlessQ connection required. Patron data from staff UI, patron portal, Integration API, or imports.

## Environment

### LMS (this repo)

```bash
# Optional: future LMS → QlessQ callbacks
QLESSQ_INTEGRATION_URL=https://qms-api.example.com/api/v1
QLESSQ_INTEGRATION_API_KEY=
```

### QlessQ (sibling `../QMS`)

```bash
LOYALTY_INTEGRATION_URL=https://pl-api.example.com/api/v1
LOYALTY_INTEGRATION_API_KEY=   # optional global fallback; prefer per-org connector config
LOYALTY_URL=https://loyalty.example.com
```

## Code locations (this repo — LMS)

| Piece                   | Path                                                                            |
| ----------------------- | ------------------------------------------------------------------------------- |
| Queue event ingestion   | `loyalty-integration.controller.ts` → `POST queue-events`                       |
| Event handlers          | `loyalty-queue-events.service.ts`                                               |
| In-process listener     | `loyalty.listener.ts` (local mode)                                              |
| Integration earn/upsert | `loyalty-integration.service.ts`                                                |
| Webhook emitter         | `loyalty-webhook.service.ts`                                                    |
| Shared contract         | `packages/shared` → `loyalty-connector.ts`, `loyalty-integration.validators.ts` |

## Code locations (QlessQ sibling)

| Piece                      | Path                                                                                    |
| -------------------------- | --------------------------------------------------------------------------------------- |
| Event emitters             | `ticket-transition.service.ts`, `appointment-lifecycle.service.ts`, `review.service.ts` |
| HTTP forwarder             | `loyalty-connector.service.ts`, `loyalty-connector.listener.ts`                         |
| Tenant link CRUD           | `loyalty-connector-link.service.ts`, `loyalty.controller.ts` (`/loyalty/connector`)     |
| Local listener (shared DB) | `loyalty.listener.ts` — skipped when remote link active                                 |

## Local dev (both products)

```bash
# Terminal 1 — QlessQ
cd ../QMS && pnpm dev:api

# Terminal 2 — LMS
pnpm start

# Point QlessQ org connector at http://localhost:4000/api/v1 with LMS integration API key
```

Shared Postgres during transition: leave connector **disconnected**; in-process listener handles events.
