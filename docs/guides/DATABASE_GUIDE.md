# Database & Prisma Guide

Standards for all database operations, schema changes, and Prisma usage.

---

## Schema Location

`packages/database/prisma/schema.prisma` is the **single source of truth** for all database models.
Never define database structure anywhere else.

---

## Model Standards

Every model must have:

```prisma
model ExampleModel {
  id         String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  orgId      String    @map("org_id") @db.Uuid
  createdAt  DateTime  @default(now()) @map("created_at")
  updatedAt  DateTime  @updatedAt @map("updated_at")
  deletedAt  DateTime? @map("deleted_at")   // if soft-delete is needed

  // Relations
  org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@index([orgId])
  @@map("example_models")  // table name is snake_case plural
}
```

**Checklist for new models:**

- [ ] UUID primary key using `gen_random_uuid()`
- [ ] `orgId` foreign key for multi-tenant isolation (unless it's a system-level model)
- [ ] `createdAt` and `updatedAt` timestamps with correct `@map`
- [ ] `@map` on all fields that differ from camelCase (i.e., all multi-word field names)
- [ ] `@@map` with snake_case table name
- [ ] Index on `orgId` at minimum
- [ ] All foreign key fields end in `Id` (camelCase)

---

## Migrations

After **every** schema change:

```bash
# Create migration
pnpm --filter @queueplatform/database db:migrate

# OR in development
cd packages/database && npx prisma migrate dev --name <description>

# Regenerate client
pnpm --filter @queueplatform/database db:generate
```

Never edit migration files after they have been applied to production.

---

## Query Patterns

### Always scope to orgId

```typescript
// ✅ Multi-tenant safe
await prisma.ticket.findMany({ where: { orgId, status: 'WAITING' } });

// ❌ Exposes ALL org data
await prisma.ticket.findMany({ where: { status: 'WAITING' } });
```

### Soft deletes

```typescript
// ✅ Soft delete
await prisma.service.update({
  where: { id, orgId },
  data: { deletedAt: new Date() },
});

// Exclude soft-deleted records
await prisma.service.findMany({
  where: { orgId, deletedAt: null },
});
```

### Transactions for multi-step operations

```typescript
// ✅ Atomic — all or nothing
const [ticket, _queue] = await prisma.$transaction([
  prisma.ticket.create({ data: ticketData }),
  prisma.queue.update({
    where: { id: queueId },
    data: { currentCount: { increment: 1 } },
  }),
]);
```

### Pagination pattern

```typescript
const page = filters.page ?? 1;
const limit = Math.min(filters.limit ?? 20, 100);

const [data, total] = await Promise.all([
  prisma.model.findMany({
    where,
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { createdAt: 'desc' },
  }),
  prisma.model.count({ where }),
]);

return {
  data,
  meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
};
```

---

## Raw Queries

Raw queries are **forbidden** in general. Only acceptable when:

1. A complex aggregation is impossible with Prisma's query API
2. A Prisma limitation requires it for performance reasons

When raw SQL is used, it **must**:

- Be parameterized (never string-interpolated)
- Have a `// REASON:` comment explaining why raw SQL was necessary

```typescript
// REASON: Prisma does not support window functions — required for rank calculation
const results = await prisma.$queryRaw`
  SELECT id, RANK() OVER (PARTITION BY queue_id ORDER BY booked_at) as position
  FROM tickets
  WHERE org_id = ${orgId}
  AND status = 'WAITING'
`;
```

---

## Seeding

`packages/database/prisma/seed.ts` manages local development seed data.

Run seeder: `pnpm --filter @queueplatform/database db:seed`

## Bootstrap QlessQ staff (or customer-org admin)

Implementation: `packages/api/scripts/bootstrap-platform-staff.ts` (run via `pnpm db:bootstrap-admin` from the repo root).

The database requires every `User` to have an `orgId`. **QlessQ staff are not attached to a customer tenant by default**: the script creates or reuses a **reserved** organization with slug **`queueplatform-internal`** (“QlessQ (platform staff)”). Users in that org are **platform operators** for the API and Admin dashboard (see `isPlatformOperator` / `PlatformOperatorGuard`). Optional **`PLATFORM_OPERATOR_*`** / **`NEXT_PUBLIC_PLATFORM_OPERATOR_*`** env vars are only for **bootstrap or break-glass** access (e.g. first deploy before internal org exists, or staff not placed in the internal org).

### Default (no `BOOTSTRAP_ORG_ID`)

- Ensures org slug `queueplatform-internal` exists, syncs system roles, adds a Free **subscription** if missing.
- Upserts the user there. Default tenant role: **`viewer`** (override with `BOOTSTRAP_SYSTEM_ROLE`).
- You can still add `PLATFORM_OPERATOR_EMAILS` / `NEXT_PUBLIC_PLATFORM_OPERATOR_EMAILS` if you need web “superadmin” nav hints or env-only operators; **dashboard-created admins in the internal org do not require them.**

Login is **global by email** for authentication; a single **Account** can link multiple **User** rows (one per org). The bootstrap script avoids surprising duplicates; use the Admin “Admins” UI for additional internal operators.

### Customer org admin (override)

Set **`BOOTSTRAP_ORG_ID`** to a real customer organization UUID. Then the user is created/updated **in that org** instead. Default tenant role becomes **`admin`** unless you set `BOOTSTRAP_SYSTEM_ROLE`.

### Tenant role vs platform operator

| Goal               | Org target                           | `BOOTSTRAP_SYSTEM_ROLE` | Env (optional)                                   |
| ------------------ | ------------------------------------ | ----------------------- | ------------------------------------------------ |
| QP staff (default) | `queueplatform-internal` (automatic) | `viewer` (default)      | Omit unless you need break-glass / web nav hints |
| Customer org admin | `BOOTSTRAP_ORG_ID=<uuid>`            | `admin` (default)       | Usually omit platform operator                   |

From the repo root (loads `.env` for `DATABASE_URL`):

```bash
pnpm db:bootstrap-admin
```

Restart API + web after changing env. **Adding operators via Admin → Admins** only requires that they can sign in at the Admin app (`platformAdmin: true` login); no env edit.

**Local defaults**

- Email: `parsa.admin@queueplatform.test` (`BOOTSTRAP_ADMIN_EMAIL`)
- Password: `Parsa123456` if `BOOTSTRAP_ADMIN_PASSWORD` is unset and `NODE_ENV` is not `production`

**Production**

1. Copy `/.env.production.example` to `/.env.production`, set `DATABASE_URL`, `BOOTSTRAP_ADMIN_PASSWORD`.
2. `pnpm db:bootstrap-admin:production`

Optional: `BOOTSTRAP_FIRST_NAME` / `BOOTSTRAP_LAST_NAME` / `BOOTSTRAP_SYSTEM_ROLE`.

---

## Prisma Studio (`http://localhost:5555`)

Prisma Studio is the fastest way to inspect and lightly edit local or Railway-linked dev data without writing one-off scripts. It binds to **port 5555** by default.

### Start

From the repo root (uses `DATABASE_URL` from `.env` or `.env.local`):

```bash
pnpm --filter @queueplatform/database db:studio
```

Then open **http://localhost:5555** in your browser. Keep the terminal running while you use Studio.

Use `.env.local` when working against Docker Postgres (`pnpm dev:full:local`):

```bash
pnpm exec dotenv -e .env.local -- pnpm --filter @queueplatform/database db:studio
```

### When to use it

| Task                                      | Models to inspect                                                                                          |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Multi-step / serve console debugging      | `Ticket`, `BranchFlowTemplate`, `BranchFlowTemplateStep`, `StationProfile`, `StationProfileQueue`, `Queue` |
| Flow template activation / parallel flows | `BranchFlowTemplate.isActive`, `Queue.flowTemplateId`, `Queue.journeyModeOverride`                         |
| RBAC / login smoke tests                  | `User`, `RoleAssignment`, `Role`                                                                           |
| Ticket lifecycle                          | `Ticket.status`, `Ticket.stepIndex`, `Ticket.flowTemplateId`, `Visit`                                      |

Studio reads the same `DATABASE_URL` as the API. After changing rows that affect serve state (station profiles, active templates, waiting tickets), refresh the serve console or re-establish the desk session if the UI looks stale.

### Helper scripts

Role-based test logins for the first org/branch in the database:

```bash
pnpm --filter @queueplatform/database db:create-test-users
```

Creates or verifies `test.{owner,admin,manager,staff}@qms.local` (password `Password123!`).

Other seed/setup scripts live under `packages/database/scripts/` (for example `setup:phone-demo`, `setup:multistep-waiting-load`).

### Safety

- Studio is for **local and non-production** databases only.
- Do not point Studio at production unless you are performing a deliberate, approved ops task.
- Prefer migrations and API flows for schema or business-logic changes; use Studio for inspection and quick dev fixes.
