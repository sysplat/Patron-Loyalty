# Patron Loyalty & CRM — separate product architecture

> **Repo:** This is the standalone **Patron Loyalty (LMS)** monorepo. QlessQ queue product lives in sibling `../QMS`. Integration: `qlessq-integration.md`.

Patron Loyalty (LMS) is a **separately sellable product** from QlessQ queue management. It can run **standalone** (loyalty-only SKU), as an **add-on** to QMS, or as a **bundle**—with its own billing, terms, and richer patron data collection. It may **connect to QlessQ** when both are licensed on the same org to consume visit/appointment/review events, but it is not a feature flag bolted onto the kiosk.

This document is the ownership map for building toward the [Loyalty Management System SRS](https://github.com/parsasamandi/QMS) scope without bloating kiosk or serve consoles.

## Product model (commercial & legal)

| SKU (`Organization.productSku`) | Queue (QMS) | Loyalty (LMS)                        | Typical buyer                       |
| ------------------------------- | ----------- | ------------------------------------ | ----------------------------------- |
| `qms`                           | Yes         | Optional add-on (`patronCrmEnabled`) | Walk-in / appointment operators     |
| `loyalty`                       | No          | Yes                                  | CRM / marketing teams without queue |
| `bundle`                        | Yes         | Yes                                  | Full platform                       |

**Separate product implications:**

- **Different purchase** — loyalty has its own Stripe plan (`loyalty-starter`); signup at `apps/loyalty` uses `productSku: loyalty`.
- **Different terms** — tenant signup and patron-facing flows for LMS must use **LMS-specific Terms and Privacy** (not QMS kiosk copy). Patron portal/profile may collect **more personal data** (birthday, gender, city, marketing preferences) than queue check-in; consent and published legal pages must reflect that.
- **Optional QlessQ connection** — when both products share an org, loyalty **reads** queue outcomes via domain events (`ticket.completed`, `appointment.*`, `review.created`, no-show) and shared `Customer` identity. Loyalty-only orgs use the **Integration API** (`X-Loyalty-Api-Key`), POS imports, or manual entry—no queue UI required.
- **Thin coupling** — queue modules emit events; loyalty modules subscribe. Do not embed loyalty business rules in ticket/kiosk code paths.

**Agent rule of thumb:** treat `apps/loyalty` + `packages/api/.../loyalty/` as a product boundary—billing, legal, UI, and PII scope are LMS concerns even when code lives in the same monorepo.

## Design principle: thin kiosk, rich loyalty app

| Surface                                                                      | Collects                                                                                                       | Purpose                               |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **Kiosk / public booking** (`apps/web` in **QMS** repo — not `apps/loyalty`) | Name, phone, email (optional), transactional SMS consent, marketing opt-in when CRM enabled                    | Issue ticket or book appointment fast |
| **Queue ops** (`apps/web` serve, workbench)                                  | Operational notes on tickets; optional link to `Customer`                                                      | Move the line                         |
| **Patron Loyalty app** (`apps/loyalty`, port **3003**)                       | Birthday, gender, address, preferences, tier, points balance, campaign enrollment, referral codes, staff tasks | Retention, marketing, loyalty rules   |
| **Patron self-service** (`apps/loyalty` `/portal/[code]`, `/card/[code]`)    | Profile enrichment, reward redemption, digital card                                                            | End-customer loyalty UX               |

**Do not add SRS profile fields to kiosk** unless there is a hard operational reason. Loyalty-specific columns and forms belong in the loyalty service UI or staff CRM screens—not on the walk-in path.

## Apps and audiences (target)

| App            | Port (local, TBD) | Audience                                     | Purpose                                        |
| -------------- | ----------------- | -------------------------------------------- | ---------------------------------------------- |
| `apps/web`     | 3000              | Tenant staff, kiosk, lobby, booking          | Queue management (unchanged core)              |
| `apps/loyalty` | **3003**          | Tenant marketing / managers / front desk CRM | Patron directory, loyalty, segments, campaigns |
| `apps/admin`   | 3002              | Platform operators                           | Enable `patronCrmEnabled`, tenant ops          |

**Interim (today):** Patron CRM v1 UI also remains in `apps/web` → `/dashboard/customers`. Primary loyalty surface: **`apps/loyalty`** (port **3003**). API: `packages/api/src/modules/loyalty/` + `packages/api/src/modules/customer/`.

## API and data ownership

### Queue domain (QMS) — source of truth for visits

- `Ticket`, `Visit`, `Appointment`, `Review`, `Queue`, `Branch`, `Service`
- Denormalized patron contact on tickets (`customerName`, `customerPhone`, `customerEmail`)
- Optional `Ticket.customerId` → `Customer` (identity stub)

### Patron identity (shared bridge)

- `Customer` — org-scoped patron record; created/updated from kiosk, booking, or loyalty app
- Minimal fields for matching: name, phone, email, consent flags
- `Customer.metadata` — staff tags/notes (CRM); loyalty may extend or replace with dedicated tables

### Loyalty domain (`packages/api/src/modules/loyalty/`)

- Points ledger, tiers, rewards catalog, redemptions, coupons, wallet
- Campaigns (manual, scheduled, automation triggers), referrals
- Gamification (badges, challenges), CRM tasks, dashboard KPIs
- Integration API (`X-Loyalty-Api-Key`) and outbound webhooks (`LOYALTY_WEBHOOK_EVENTS`)
- Public patron portal and digital card by referral code

### Feature gate

- `Organization.patronCrmEnabled` — platform operator toggle (like `appointmentsEnabled`)
- Checked by `PatronCrmFeatureService` before loyalty/CRM API and UI
- Kiosk `crmEnabled` meta flag follows the same org flag (marketing opt-in only—not a full loyalty form)

## Integration between QMS and Loyalty

When both products are licensed, patron loyalty **consumes** queue events; it does not replace queue APIs. **Loyalty-only tenants** skip this path and ingest data via integration API, imports, or staff entry.

```text
┌─────────────────┐     events (optional)      ┌──────────────────────┐
│  QlessQ (queue) │ ─────────────────────────► │  Patron Loyalty      │
│  ticket.completed│     customerId, branchId   │  earn points         │
│  appointment.*  │     serviceId, timestamps  │  segments, campaigns │
│  review.created │                            │  full patron profile │
└─────────────────┘                            └──────────────────────┘
         │              Integration API / webhooks          ▲
         └──────────── Customer (shared when linked) ──────┘
                              OR loyalty-only org (no queue)
```

Recommended event sources (implement incrementally):

| QMS event                        | Loyalty action                                      |
| -------------------------------- | --------------------------------------------------- |
| Ticket completed / served        | Earn points; increment visit count; segment refresh |
| Appointment completed            | Earn points; retention metrics                      |
| Appointment no-show              | Risk flag; win-back segment                         |
| Review submitted                 | Satisfaction segment; optional bonus points         |
| Customer created (kiosk/booking) | Ensure loyalty profile stub exists                  |

Outbound **webhooks** (`WebhookEndpoint` + `LOYALTY_WEBHOOK_EVENTS`) fire on customer created, points earned/redeemed, tier upgraded, visit no-show, and reward redeemed. Tenants can also use the **Integration API** (`X-Loyalty-Api-Key`) for POS/e-commerce.

## What to build where

| Feature                                   | Build in                                           |
| ----------------------------------------- | -------------------------------------------------- |
| Kiosk check-in, lobby, serve              | `apps/web` (existing)                              |
| Patron directory, timeline, segments (v1) | `apps/loyalty` (move from web dashboard over time) |
| Points, tiers, rewards, campaigns         | `packages/api/.../loyalty/` + `apps/loyalty`       |
| Platform enable/disable                   | `apps/admin` → `PATCH .../patron-crm`              |
| Shared types, validators                  | `packages/shared`                                  |
| SMS/email sends                           | `packages/notifications` (loyalty enqueues jobs)   |

## Monorepo vs separate deploy

- **Monorepo:** Same repo (`apps/loyalty`, `packages/api` loyalty module, shared Prisma schema or loyalty schema namespace). Preferred for v1.
- **Separate deploy:** Loyalty app and API can run as a second Railway service later; identity via same `DATABASE_URL` tenant RLS or service-to-service API with org JWT.

Do **not** fork a random open-source LMS into the monorepo; build queue-native loyalty or integrate external LMS via webhooks.

## Migration from current state

1. **Done:** `customer` API module, `Customer` + `CustomerSegment`, `patronCrmEnabled`, Patrons UI in `apps/web`.
2. **Done:** `apps/loyalty` staff app (dashboard, patrons, rewards, coupons, referrals, campaigns, program, engagement, reports, integrations, tasks).
3. **Done:** `loyalty` API module — full SRS v1 scope including queue hooks (ticket/appointment/review/no-show), scheduled campaigns, patron portal, integration API, points expiry job.
4. **Later:** Deprecate `/dashboard/customers` in `apps/web` in favor of loyalty app; native mobile app; coalition/marketplace; ML-based AI features from SRS §24.

**Legal (LMS):** Tenant Terms/Privacy at `apps/loyalty` `/terms` and `/privacy`; patron portal notices at `/patron-terms` and `/patron-privacy`. Document types in `LEGAL_DOCUMENT_TYPES` (`loyalty_*`). Counsel review before production marketing.

## Adding a loyalty feature (checklist)

1. API under `packages/api/src/modules/loyalty/` (or extend `customer/` only for CRM-only features).
2. UI in `apps/loyalty`—not kiosk routes, not `apps/admin`.
3. New patron fields in loyalty tables or loyalty UI forms—not kiosk `step-enter-info` unless explicitly required.
4. Gate with `patronCrmFeature.requireEnabled(orgId)`.
5. Emit or handle domain events from ticket/appointment modules without tight coupling (event emitter or small integration service).

## Related docs

- [SRS completion map](./srs-completion.md) — module-by-module status vs `Complete_Loyalty_Management_System_SRS.pdf`
- [admin-surface.md](./admin-surface.md) — web vs admin boundaries
- [queue-session.md](./queue-session.md) — serve/kiosk session model
- `packages/api/src/modules/customer/` — Patron CRM v1 (interim)
- `packages/api/src/common/features/patron-crm-feature.service.ts` — org feature flag
