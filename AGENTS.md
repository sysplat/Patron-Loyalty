# Patron Loyalty (LMS) — agent guide

Standalone patron loyalty product (CRM, points, tiers, campaigns). **Not** the QlessQ queue/kiosk app.

Requires **Node >= 20** and **pnpm >= 9**.

## Layout

```text
apps/loyalty/            Staff UI + patron portal (port 3003)
packages/api/            NestJS API — loyalty module + auth, billing, customer
packages/database/       Prisma + PostgreSQL
packages/frontend-core/  Shared realtime hooks
packages/notifications/  SMS/email workers
packages/shared/         Types, validators, legal constants
```

## Boundaries

- **LMS UI** → `apps/loyalty` only (no kiosk, serve, or platform admin UI in this repo).
- **QlessQ connection** → optional; consume queue events via Integration API / webhooks (`docs/architecture/qlessq-integration.md`).
- **Legal** → LMS-specific pages in `apps/loyalty`; do not reuse QlessQ kiosk patron copy for loyalty portal.
- **Platform admin** → not in this repo (use QlessQ `apps/admin` or a future LMS admin surface).

## Commands

```bash
pnpm install
cp .env.example .env
pnpm start              # dev stack
pnpm dev:notifications  # SMS/email worker (separate terminal)
pnpm validate
pnpm typecheck
pnpm test
```

## Prisma

Schema in `packages/database`. After changes: migrate, then `pnpm db:generate`.

## Integration with QlessQ

When a tenant uses both products, QlessQ emits visit/appointment events; LMS earns points and updates segments. Loyalty-only tenants use POS/import/API. See `docs/architecture/qlessq-integration.md`.
