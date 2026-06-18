# GitHub Copilot Instructions for QMS

These instructions apply automatically to every response GitHub Copilot gives in this repository.
Read and follow all of them on every prompt — they are not optional.

---

## Project Overview

**QlessQ (QMS)** is a multi-tenant SaaS queue management system.

- **Backend API**: NestJS + Prisma + BullMQ + PostgreSQL — in `packages/api/`
- **Frontend**: Next.js 14 App Router + TailwindCSS + shadcn/ui — in `apps/web/`
- **Shared types/validators**: `packages/shared/`
- **Database schema**: `packages/database/prisma/schema.prisma` — single source of truth
- **Monorepo**: pnpm workspaces + Turborepo
- **Deployment**: Railway (Nixpacks)

---

## Working Standards

Follow [../docs/STANDARDS.md](../docs/STANDARDS.md) as the source of truth. The priorities in this repo are:

1. tenant isolation and security
2. correctness and deployment safety
3. maintainability and consistency
4. performance where it matters

### Always enforce

- No hardcoded secrets, tokens, or keys
- Scope tenant-owned data by `orgId`
- Keep controllers thin; business logic belongs in services
- Use typed NestJS exceptions for normal backend domain failures
- Keep browser-side HTTP inside `apps/web/src/lib/api.ts`
- Prefer server components; do not use `useEffect` for initial remote data fetching when a better pattern exists
- Remove temporary diagnostics and debug artifacts before finalizing

### Strong defaults

- Use TypeScript strictness; avoid `any` unless justified
- Add explicit return types on exported and public functions
- Add JSDoc to services, adapters, and public methods with non-obvious business or integration behavior
- Use soft deletes for business data where recovery or auditability matters
- Use `prisma.$transaction()` for multi-step writes when atomicity matters

### Railway deployment invariants

- Keep the shared package build before Prisma generate and API build
- Keep `healthcheckPath` at `/api/v1/health`
- Do not change API deploy commands casually; align with `railway/api.railway.json`
- Never commit `.env` files

### Git commits

Always use Conventional Commits format:

```
feat(scope): description
fix(scope): description
refactor(scope): description
```

Scopes: `api`, `web`, `shared`, `database`, `deploy`, `notifications`

---

## Self-Audit Before Finalizing Any Code

Before providing any code change, verify:

- [ ] No `any` types without comment justification
- [ ] Return types on exported/public functions where they define a contract
- [ ] JSDoc on services/adapters and non-obvious public methods
- [ ] NestJS typed exceptions (not generic `Error`)
- [ ] `orgId` scoping on all DB queries
- [ ] No secrets hardcoded
- [ ] No `console.log` in production code (use NestJS `Logger` in API)
- [ ] No raw `fetch()` in frontend components
- [ ] Soft delete used where appropriate

---

## Full Standards Reference

For complete details, see the docs folder:

- `docs/STANDARDS.md` — master standards document
- `docs/guides/API_MODULE_GUIDE.md` — NestJS module patterns
- `docs/guides/FRONTEND_GUIDE.md` — Next.js/React patterns
- `docs/guides/DATABASE_GUIDE.md` — Prisma/DB patterns
- `docs/deployment/DEPLOYMENT_GUIDE.md` — Railway deployment config
- `docs/README.md` — documentation index
- `docs/CONTRIBUTING.md` — development workflow and review checklist
- `docs/compliance/COMPLIANCE_NEXT_STEPS.md` — legal sync workflow and operator checklist
- `docs/compliance/SUPPORT_OPERATIONS.md` — AI-assisted support; Privacy Mode required when processing Customer Data
- `docs/architecture/admin-surface.md` — platform vs tenant app ownership
- `docs/architecture/10-10-plan.md` — completed architecture milestones (historical record)
