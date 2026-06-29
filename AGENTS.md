# Patron Loyalty (LMS) — agent guide

Standalone patron loyalty product (CRM, points, tiers, campaigns). **Not** the QlessQ queue/kiosk app.

Requires **Node >= 20** and **pnpm >= 9**.

## Green path (local — GitHub Actions disabled until July 2026)

```bash
pnpm install
cp .env.example .env          # when present
pnpm validate:ci              # lint, types, legal, security + architecture gates
pnpm test                     # unit (api, shared, loyalty, notifications)
pnpm audit:loyalty-coverage   # loyalty module coverage gate
pnpm audit:staging-soak        # prod boundary curls (no Actions minutes)
```

E2E (API + loyalty running locally): `pnpm --filter @queueplatform/e2e test`

Pre-release: `pnpm audit:patron-loyalty` (Railway migration + prod smoke when linked)

## Layout

```text
apps/loyalty/            Staff UI + patron portal (port 3003)
packages/api/            NestJS API — loyalty module + auth, billing, customer
packages/database/       Prisma + PostgreSQL
packages/frontend-core/  Shared realtime hooks
packages/notifications/  SMS/email workers
packages/shared/         Types, validators, legal constants
packages/e2e/            Playwright smoke
```

## Boundaries

- **LMS UI** → `apps/loyalty` only (no kiosk, serve, or platform admin UI in this repo).
- **QlessQ UI** → sibling `../QMS` repo (`apps/web`, `apps/admin`) — see [REPO_BOUNDARIES.md](docs/architecture/REPO_BOUNDARIES.md).
- **QlessQ connection** → optional; queue events via Integration API (`docs/architecture/qlessq-integration.md`).
- **Platform admin** → not in this repo.

## Key docs

| Doc                                                                              | Purpose                                       |
| -------------------------------------------------------------------------------- | --------------------------------------------- |
| [TESTING.md](docs/operations/TESTING.md)                                         | Test tiers, CI matrix (disabled), local gates |
| [PATRON_LOYALTY_10X_ROADMAP.md](docs/architecture/PATRON_LOYALTY_10X_ROADMAP.md) | Phase plan + scorecard                        |
| [REPO_BOUNDARIES.md](docs/architecture/REPO_BOUNDARIES.md)                       | LMS vs QMS surfaces, deploy profile           |
| [LOYALTY_AUTH_BFF.md](docs/architecture/LOYALTY_AUTH_BFF.md)                     | Cookie-only staff auth                        |
| [adr/](docs/architecture/adr/README.md)                                          | Architecture decision records                 |
| [QLESSQ_CONNECTOR_OPS.md](docs/operations/QLESSQ_CONNECTOR_OPS.md)               | Connector ops + Sentry                        |

## Prisma

Schema in `packages/database/prisma/` (multi-file). After changes: migrate, then `pnpm db:generate`.

## Integration with QlessQ

QlessQ emits visit/appointment events; LMS earns points via `POST /loyalty/integrations/v1/queue-events`. See `docs/architecture/qlessq-integration.md`.
