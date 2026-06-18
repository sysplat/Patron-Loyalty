# Contributing to QlessQ

This repository uses project-specific standards designed for a multi-tenant monorepo that ships to Railway. The goal is consistency without unnecessary rigidity.

## Development Workflow

1. Branch from `main`
2. Install dependencies with `pnpm install`
3. Copy `.env.example` to `.env` and configure secrets locally
4. Start local infrastructure with `pnpm docker:up`
5. Run the app with `pnpm dev` or targeted package commands
6. Validate your changes before pushing
7. Open a pull request with a Conventional Commit title

## Branch Naming

Use one of the following:

- `feat/<name>`
- `fix/<name>`
- `refactor/<name>`
- `docs/<name>`

## Commit Messages

Use Conventional Commits:

```text
feat(api): add branch schedule override validation
fix(web): correct queue filter state reset
docs: refine project README
refactor(shared): extract reusable date helpers
```

## Engineering Expectations

### Design

- Follow SOLID, DRY, KISS, and YAGNI as defaults, not cargo cult rules
- Prefer composition over inheritance
- Extract reusable logic into focused helpers, hooks, or services
- Avoid oversized files with mixed responsibilities

### Backend

- Keep controllers thin
- Put business logic in services
- Use typed NestJS exceptions
- Scope multi-tenant queries by `orgId`
- Use `prisma.$transaction()` when atomicity matters for multi-step writes
- Keep module boundaries explicit; do not reach into another module's internals for convenience
- Make sensitive state-changing flows idempotent or document why they are not

### Frontend

- Use server components by default
- Use `'use client'` only when required
- Route all HTTP calls through `apps/web/src/lib/api.ts`
- Do not use `useEffect` for initial remote data fetching when a server component or React Query fits better
- Handle loading, empty, and error states explicitly

### Comments and docs

- Add comments only where they improve understanding
- Document intent, tradeoffs, and non-obvious rules
- Add JSDoc to services, adapters, and public methods that carry business or integration complexity
- Do not leave temporary recovery notes, transcript analyses, or debug-only documentation in the repository

### Enterprise-grade expectations

- Add auditability for sensitive admin, billing, permission, and queue-override actions
- Prefer structured logs, correlation IDs, and measurable failure paths for critical flows
- Treat reporting/analytics as a separate design concern when queries stop looking like normal CRUD
- Treat deploy config, migrations, and job behavior changes as production-risk changes that need extra review

## Validation Checklist

Run the smallest sufficient checks for the area you changed before pushing:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Useful targeted checks:

```bash
pnpm --filter @queueplatform/api build
pnpm --filter @queueplatform/api test
pnpm --filter @queueplatform/web typecheck
pnpm --filter @queueplatform/web build
pnpm --filter @queueplatform/shared build
pnpm --filter @queueplatform/shared test
pnpm --filter @queueplatform/notifications build
pnpm --filter @queueplatform/database db:generate
```

## Repository Hygiene

- Do not commit `.env` files
- Do not commit `.venv`, `node_modules`, local logs, or scratch directories
- Remove one-off debug scripts once they are no longer needed
- Keep the repository root limited to durable project assets

## High-value review prompts

Before merging a change, ask:

- Does this preserve tenant isolation and least privilege?
- Does this create or change an auditable action?
- Is the failure mode observable in logs and metrics?
- Will this query or workflow still behave well at materially higher load?
- Is the deployment or rollback path obvious?

## Primary References

- [../README.md](../README.md)
- [STANDARDS.md](../STANDARDS.md)
- [API_MODULE_GUIDE.md](../guides/API_MODULE_GUIDE.md)
- [FRONTEND_GUIDE.md](../guides/FRONTEND_GUIDE.md)
- [DATABASE_GUIDE.md](../guides/DATABASE_GUIDE.md)
- [DEPLOYMENT_GUIDE.md](../deployment/DEPLOYMENT_GUIDE.md)
- [README.md](../README.md) — documentation index
