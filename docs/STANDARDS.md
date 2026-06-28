# QMS Engineering Standards

> **Patron Loyalty repo:** This workspace ships **`apps/loyalty`** only. Sections referencing `apps/web`, `apps/admin`, kiosk, or queue serve surfaces apply to sibling **`../QMS`**. See [architecture/REPO_BOUNDARIES.md](./architecture/REPO_BOUNDARIES.md).

This document defines the standards for QlessQ (QMS). It is intentionally tuned to this repository, its deployment model, and its product constraints.

These standards are not meant to be dogma. They are the best defaults for this codebase. The rule order is:

1. tenant isolation and security
2. correctness and operational safety
3. consistency and maintainability
4. performance where it matters
5. style preferences

If a lower-priority rule conflicts with a higher-priority one, the higher-priority rule wins. If a change needs an exception, document the reason in code or in the PR.

---

## 1. Project profile

**QlessQ (QMS)** is a multi-tenant SaaS queue management system built as a monorepo.

| Area                            | Stack                                                            | Primary location                             |
| ------------------------------- | ---------------------------------------------------------------- | -------------------------------------------- |
| Tenant/customer web             | Next.js App Router, TailwindCSS, shadcn/ui, React Query, Zustand | `apps/web/`                                  |
| Platform operator admin         | Next.js App Router, TailwindCSS, shadcn/ui, React Query, Zustand | `apps/admin/`                                |
| Core API                        | NestJS, Prisma, PostgreSQL, BullMQ                               | `packages/api/`                              |
| Shared contracts and validators | TypeScript, Zod                                                  | `packages/shared/`                           |
| Database schema and migrations  | Prisma                                                           | `packages/database/`                         |
| Notification worker             | TypeScript, BullMQ                                               | `packages/notifications/`                    |
| Realtime transport              | Centrifugo                                                       | `apps/centrifugo/`, `docker/centrifugo.json` |
| Deployment                      | Railway, Nixpacks, pnpm workspaces, Turborepo                    | `railway/`                                   |

The standards below optimize for:

- safe multi-tenant behavior
- predictable deployment to Railway
- clear separation between UI, API, worker, and realtime concerns
- fast local development in a monorepo

---

## 2. Core repository rules

### Non-negotiable rules

- Never bypass tenant isolation for tenant-owned data.
- Never hardcode secrets, tokens, or credentials.
- Never put business logic in controllers or route handlers when a service boundary exists.
- Never add raw `fetch()` calls inside React components; browser-side HTTP goes through `apps/web/src/lib/api.ts`.
- Never leave temporary diagnostics, recovery notes, transcript dumps, or one-off debug artifacts in committed code.
- Never change Railway deployment commands casually; deployment config is production-critical.

### Strong defaults with allowed exceptions

- Prefer explicit return types on exported functions, public methods, and boundary functions.
- Prefer JSDoc on services, adapters, and public methods that enforce business rules or integration behavior.
- Prefer soft deletes for business records.
- Prefer extracting reusable helpers only after a real reuse signal or a stable boundary appears.

When deviating from a strong default, leave a short explanation near the code or in the PR.

---

## 3. Repository structure and ownership

### Web app

`apps/web/src/app/`

- `(dashboard)/` authenticated staff UI
- `(kiosk)/` customer self-service booking
- `(display)/` branch display boards
- `(public)/` marketing and auth-facing pages
- `(track)/` ticket tracking

`apps/web/src/components/ui/` is for shared UI primitives only. Domain components belong closer to the feature that owns them.

### API

`packages/api/src/modules/<feature>/`

- `<feature>.module.ts`
- `<feature>.controller.ts`
- `<feature>.service.ts`
- `dto/`
- supporting mappers, validators, helpers, and tests as needed

### Shared package

`packages/shared/src/`

- `types/` for shared contracts
- `validators/` for shared schema validation
- `constants/` for stable shared constants
- `utils/` for pure utilities with no app-specific side effects

### Database

`packages/database/prisma/schema.prisma` is the single source of truth for schema design.

Live queue lines (agent console, track position, lobby) share one **branch-local day** session boundary. See [queue-session.md](./architecture/queue-session.md).

### Worker

- `packages/notifications/` owns background notification delivery.

Do not create new top-level package folders or parallel architecture patterns without updating this document.

### Runtime ownership boundaries

- `apps/web` owns tenant/customer presentation, user flows, and browser-side state only.
- `apps/admin` owns platform-operator presentation and cross-tenant operational surfaces.
- `packages/api` owns domain workflows, authorization, validation, orchestration, and transactional state changes.
- `packages/notifications` owns asynchronous delivery side effects such as email and SMS sending.
- `packages/shared` owns stable shared contracts, validators, and constants.
- `packages/database` owns schema evolution and generated database client workflows.
- `apps/web` must not expose compatibility routes for platform-admin pages; link platform operators to `apps/admin` via `NEXT_PUBLIC_ADMIN_URL`.

The same business rule must not be implemented independently in multiple runtime layers. If the same rule appears in web, API, and worker code, move the source of truth to the most appropriate backend/shared boundary.

---

## 4. Naming and code organization

### General naming

| Item                  | Convention                                        | Example                |
| --------------------- | ------------------------------------------------- | ---------------------- |
| Files                 | `kebab-case`                                      | `create-ticket.dto.ts` |
| Classes               | `PascalCase`                                      | `TicketService`        |
| Interfaces            | `PascalCase` without `I` prefix                   | `TicketFilters`        |
| Types                 | `PascalCase`                                      | `TicketStatus`         |
| Functions and methods | `camelCase`                                       | `issueTicket()`        |
| Constants             | `SCREAMING_SNAKE_CASE` for module-level constants | `MAX_RETRY_COUNT`      |
| React components      | `PascalCase`                                      | `TicketCard`           |
| React hooks           | `use` + `camelCase`                               | `useQueueFilters`      |

### API and route naming

- Use plural resource names for primary endpoints: `/tickets`, `/branches`, `/services`.
- Use nested routes only when the relationship is part of the resource identity.
- Use action suffixes only for domain commands that are not CRUD: `/tickets/:id/call`, `/tickets/:id/complete`.

### File organization

- Keep files focused. A file should usually have one primary responsibility.
- Extract helpers when the logic is reused, hard to test in place, or obscures the main path.
- Avoid catch-all files such as `helpers.ts`, `misc.ts`, or `common-utils.ts` unless they are genuinely small and cohesive.

---

## 5. TypeScript standards for this repo

These rules apply to `apps/web`, `packages/api`, `packages/shared`, and `packages/notifications`.

- TypeScript strict mode is the baseline. Do not add `any` unless there is a justified comment.
- Use `unknown` instead of `any` at untrusted boundaries, then narrow.
- Add explicit return types on:
  - exported functions
  - public class methods
  - reusable hooks
  - API/client helpers
  - functions whose return shape is part of a contract
- Local inline callbacks do not need explicit return types unless it improves clarity.
- Use `interface` for extendable object shapes and public contracts.
- Use `type` for unions, mapped types, utility compositions, and function signatures.
- Prefer `const`; use `let` only when mutation is required; never use `var`.
- Prefer `?.` and `??` over truthiness shortcuts when nullability matters.
- Avoid double assertions. If a cast is unavoidable, keep it narrow and explain why.
- Keep async error handling at the correct layer. Do not wrap every async function in boilerplate `try/catch`; catch where a failure is translated, logged, retried, or recovered.

---

## 6. Multi-tenant data rules

QMS is multi-tenant first. Tenant isolation is a product rule, not just an implementation detail.

- Tenant-owned reads and writes must be scoped by `orgId`.
- If a record also belongs to a branch, desk, queue, or service, validate both the direct identifier and the tenant boundary.
- Do not trust client-provided cross-tenant identifiers without server-side verification.
- Shared or global tables are the only acceptable exception to `orgId`; if a model is intentionally global, document that in the schema or service.
- Authorization checks belong before side effects.

For new models:

- Tenant-owned business models should usually include `id`, `orgId`, `createdAt`, `updatedAt`, and `@map` / `@@map`.
- Join tables, lookup tables, or global config models may omit some of these fields if there is a documented reason.

---

## 7. NestJS API standards

### Layering

- Controllers stay thin: validate input, call services, shape transport concerns.
- Services own business rules and orchestration.
- Controllers must not call Prisma directly.
- Multi-step persistence flows should use `prisma.$transaction()` when atomicity matters.

### DTOs and API contracts

- Public request DTOs use `class-validator` and `@ApiProperty` where appropriate.
- Swagger decorators belong on externally exposed controller methods.
- Keep DTOs transport-focused; do not move business logic into DTO classes.

### Exceptions and logging

- Services throw typed NestJS exceptions such as `NotFoundException`, `BadRequestException`, `ForbiddenException`, and `ConflictException`.
- Avoid generic `Error` for normal domain failures inside services.
- Use structured logging for operationally important events. Prefer NestJS logging abstractions or the repository-standard logger over `console.log`.

### Module design

- Export only what other modules need.
- Avoid circular dependencies; if one appears, fix the dependency design instead of normalizing the cycle.
- Prefer smaller feature modules over giant cross-domain modules.
- Keep module boundaries explicit: read another module through its public service or a stable shared contract, not through private helpers or direct cross-module Prisma assumptions.
- If a module needs data from another module frequently, prefer a composed application service or dedicated query service rather than leaking internals.
- Sensitive state-changing flows should define idempotency expectations and failure behavior explicitly.

---

## 8. Frontend standards for QMS

### Rendering and data flow

- Pages are server components by default.
- Add `'use client'` only for interactivity, browser-only APIs, or client state.
- Do not use `useEffect` for initial remote data fetching when a server component or React Query can express it better.
- Browser-side HTTP goes through `apps/web/src/lib/api.ts`.
- Shared request/response shapes should come from `@queueplatform/shared` when they are stable across packages.

### UI behavior

- Every async screen handles loading, empty, error, and success states.
- Prefer reusable primitives and feature components over duplicated JSX.
- Use `next/link` and `next/image` where appropriate.
- No inline styles unless a third-party library integration makes them unavoidable.
- Tailwind class order should stay predictable: layout → spacing → typography → color → effects.

### State management

- Server state belongs in server components or React Query.
- Local UI state can use React state.
- Cross-screen client state belongs in a small dedicated store such as Zustand only when prop flow becomes a real burden.

---

## 9. Shared package standards

`@queueplatform/shared` is the contract surface between packages.

- Keep it framework-light and side-effect free.
- Prefer stable domain contracts, validators, and constants.
- Do not import app-specific runtime services into shared code.
- If a validator or type will be consumed by more than one package, move it here instead of copying it.

---

## 10. Database and Prisma standards

- `packages/database/prisma/schema.prisma` is the source of truth.
- New schema changes require a migration unless the workflow explicitly uses push-only local iteration.
- Run `db:generate` after schema changes.
- Soft delete with `deletedAt` is the default for business records that may need auditability, recovery, or reporting continuity.
- Hard delete is acceptable for ephemeral, derived, or no-business-value data.
- Use Prisma query APIs by default.
- Raw SQL is an exception only when Prisma cannot express the query cleanly or efficiently; parameterize it and add a `// REASON:` comment.
- Do not manually manage Prisma disconnects inside request code.

### Reporting and analytics rules

- Do not force complex reporting through the same patterns used for simple CRUD.
- For reporting-heavy paths, prefer one of: dedicated read services, database views, materialized views, or reviewed raw SQL.
- Reporting queries must be tenant-safe, measurable, and easy to explain during incident review.
- If a query becomes performance-critical, document its expected volume, indexes, and fallback path.

---

## 11. Notifications and background job standards

These rules apply to `packages/notifications` and BullMQ-backed flows in the API.

- API code enqueues work; workers execute side effects.
- External providers must sit behind provider classes or adapters.
- Background jobs should be idempotent where practical.
- Log enough context to diagnose failures without leaking secrets or PII unnecessarily.
- Retries should be deliberate. Do not retry non-transient failures blindly.

---

## 12. Auditability, observability, and operational readiness

### Auditability

- Security-sensitive and business-sensitive actions must be traceable.
- At minimum, record who did what, to which resource, when, and within which organization.
- Audit logs should be append-oriented and should not depend on transient client-side state.
- Administrative actions, permission changes, billing changes, destructive actions, and queue override actions should be auditable.

### Observability

- Use structured logs with request or correlation identifiers where possible.
- New critical flows should expose enough telemetry to answer: did it start, did it finish, how long did it take, and why did it fail?
- Metrics and dashboards should cover API errors, job failures, queue depth, notification failures, database latency, and deployment health.
- Avoid logging secrets or unnecessary PII.

### Operational readiness

- Health endpoints should reflect critical dependency health, not just process liveness, when feasible.
- Define retry, timeout, and dead-letter behavior for external integrations and background jobs.
- Production changes should be reversible or low-blast-radius by design.
- Incident notes belong in tickets, PRs, or runbooks, not as long-term code artifacts.

---

## 13. Comments and documentation

### Comment when it adds value

Comments should explain:

- why a rule or workaround exists
- business constraints
- edge cases and tradeoffs
- temporary limitations and removal conditions

### Do not comment the obvious

Avoid comments that merely restate the code.

### JSDoc expectations

- Services, adapters, and infrastructure classes should have short top-level intent comments.
- Public methods that enforce business rules, tricky flows, or external integration behavior should have JSDoc.
- Small obvious internal helpers do not need ceremony.

### TODO and temporary notes

Use explicit markers:

- `// TODO(name): description — YYYY-MM`
- `// FIXME:` for known bugs
- `// HACK:` for temporary technical compromises

Remove temporary diagnostics and incident notes once they are no longer operationally useful.

---

## 14. Security and compliance

- Never commit `.env` files.
- All secrets come from environment variables.
- JWT secrets must be strong in production.
- Passwords are hashed with bcrypt using a cost that remains secure without harming login throughput; the current baseline is `>= 12`.
- Validate untrusted input before business logic.
- Keep CORS restrictive in production.
- Do not expose raw stack traces or provider internals to end users.

### Enterprise-grade defaults

- Prefer SSO/OIDC/SAML readiness over username-password only assumptions.
- Use least-privilege authorization and avoid broad admin shortcuts.
- Encrypt sensitive data at rest when it carries business or compliance risk.
- Rotate secrets and keys with an operational procedure, not ad hoc edits.
- Vendor integrations must have failure isolation, timeout configuration, and audit visibility.

---

## 15. Testing and validation

Testing in this repo is risk-based, not checkbox-based.

### Expected test coverage

- New business logic should usually include tests.
- Bug fixes should include regression coverage when practical.
- Shared validators and pure utilities are high-value test targets.
- For UI changes, prefer testing the logic layer or data-shaping layer when component testing is too expensive.

### Validation before pushing

Run the smallest sufficient set for the area you changed:

#### Whole repo or cross-cutting work

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

#### API

- `pnpm --filter @queueplatform/api build`
- `pnpm --filter @queueplatform/api test`

#### Web

- `pnpm --filter @queueplatform/web typecheck`
- `pnpm --filter @queueplatform/web build`

#### Shared

- `pnpm --filter @queueplatform/shared build`
- `pnpm --filter @queueplatform/shared test`

#### Notifications

- `pnpm --filter @queueplatform/notifications build`

#### Database

- `pnpm --filter @queueplatform/database db:generate`
- run the relevant migration or push flow for schema work

Do not claim validation you did not actually run.

---

## 16. Deployment standards

Railway deployment rules are repository-critical.

- `railway/api.railway.json` is the deployment source of truth for the API.
- The API build command must keep shared build and Prisma generation before the API build:
  ```
  pnpm install --frozen-lockfile --prod=false && pnpm --filter @queueplatform/shared build && pnpm --filter @queueplatform/database db:generate && pnpm --filter @queueplatform/api build
  ```
- Keep the API deploy command deterministic and shell-light. The current standard command is:
  ```
  pnpm --filter @queueplatform/database db:migrate:deploy && node packages/api/dist/main.js
  ```
- `healthcheckPath` must remain `/api/v1/health`.
- `healthcheckTimeout` must remain high enough for cold start; the current baseline is `60`.
- Environment values live in Railway, not in committed files.

### Enterprise-grade deployment expectations

- Production deploys should be observable, reversible, and low-surprise.
- Keep startup commands simple enough to debug from logs alone.
- Treat migration steps as production changes; know whether they are backward compatible before deploy.
- Document rollback assumptions for deploy config changes, schema changes, and background job changes.
- Prefer feature flags or staged rollout patterns for risky behavior changes.

### Incident discipline

- Every production incident should produce a clear root cause, corrective action, and prevention action.
- Do not leave emergency debug code in the mainline after an incident is resolved.
- Update standards or runbooks when an incident reveals a missing guardrail.

---

## 17. Branching and commits

- Branch from `main`.
- Use branch names like `feat/<name>`, `fix/<name>`, `refactor/<name>`, `docs/<name>`.
- Use Conventional Commits:
  - `feat(api): add appointment slot availability endpoint`
  - `fix(web): correct wait time display on kiosk ticket screen`
  - `refactor(shared): extract date helpers`
  - `deploy(api): update Railway build command`
- No direct commits to `main` for non-trivial work.

---

## 18. Code review checklist

Before finalizing a change, verify:

- [ ] Tenant isolation is preserved.
- [ ] Security-sensitive values are not hardcoded.
- [ ] Business logic lives in the correct layer.
- [ ] Public contracts are typed clearly.
- [ ] Error handling is user-safe and operationally useful.
- [ ] Tests or validation were added where risk justifies them.
- [ ] Observability and audit implications were considered for sensitive or high-value flows.
- [ ] Reporting/query changes have an appropriate strategy for scale and explainability.
- [ ] No debug leftovers remain.
- [ ] Deployment-sensitive files were changed intentionally.

---

## 19. Exception policy

Good standards allow informed exceptions.

An exception is acceptable when it clearly improves one of these:

- production safety
- tenant isolation
- correctness
- measurable performance in a hot path
- compatibility with framework or infrastructure constraints

When taking an exception:

- keep it as narrow as possible
- document the reason
- avoid setting a misleading precedent for unrelated code

---

## 20. Production Safety & Staging Release Standards

To "freeze" the working core system and protect our live customers from unexpected regressions or downtime when new features are added, the following safety standards are strictly enforced:

### A. Environment Isolation (Staging vs. Production)

- **Zero Cross-Talk:** The Staging API must _never_ connect to the Production Database or Redis instance. Under no circumstances should production data be mixed with staging configurations.
- **Third-Party Services:** Use separate developer accounts or sandbox environments for integrations (e.g., Stripe Test Mode, Twilio Sandboxes) in the staging environment.

### B. Git Branch Protection

- **Immutable Main Branch:** Direct pushes to the `main` (or `production`) branch are strictly prohibited.
- **Workflow:** All feature development must take place on short-lived branches (`feature/*`) branched from `staging`. Features must be merged into `staging` and verified there before staging is promoted to `main`.
- **Quality Gates:** Code cannot be merged into `main` unless the following automated checks pass in full:
  - Monorepo compilation and typecheck (`pnpm typecheck`)
  - Full backend and frontend unit/integration test suites (`pnpm test`)
  - End-to-end user journey validation tests (`pnpm test:e2e`)

### C. Safe Database Schema Migrations

- **Additive Schema Evolution:** Database changes must be backward-compatible. Do not drop or rename columns that are currently in use by the active API. First "Expand" the schema (add new fields), deploy the new code to utilize them, "Migrate" the data, and only "Contract" (clean up old fields) in a subsequent release.
- **Automated Deployment:** Production migrations are applied strictly at deploy-time using `prisma migrate deploy` before the new container starts.

### D. Feature Flag Gating

- High-risk customizations, experimental features, or unfinished customer-specific pages must be locked behind feature flags (configuration flags in the database or config store). This allows shipping the code safely to production in a disabled state, isolating customers from potential issues.
