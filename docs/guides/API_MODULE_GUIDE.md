# API Module Development Guide

This guide covers how to create, extend, and modify NestJS API modules in this project.
Follow every section exactly — inconsistency between modules creates maintenance debt.

---

## Module Anatomy

Every feature module lives at `packages/api/src/modules/<feature>/` and contains:

```
<feature>/
  <feature>.module.ts       – NestJS module definition
  <feature>.controller.ts   – HTTP route handlers (thin, no business logic)
  <feature>.service.ts      – All business logic
  <feature>.service.spec.ts – Unit tests (required)
  dto/
    create-<feature>.dto.ts
    update-<feature>.dto.ts
```

---

## Controller Rules

```typescript
/**
 * Handles HTTP endpoints for the <Feature> resource.
 * All routes are protected by JwtAuthGuard unless decorated with @Public().
 */
@ApiTags('<feature>')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('features')
export class FeatureController {
  constructor(private readonly featureService: FeatureService) {}

  @Get()
  @ApiOperation({ summary: 'List all features for the organization' })
  @ApiResponse({ status: 200, description: 'Returns paginated list' })
  async list(@CurrentUser() user: JwtPayload) {
    return this.featureService.list(user.orgId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new feature' })
  @ApiResponse({ status: 201, description: 'Feature created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateFeatureDto) {
    return this.featureService.create(user.orgId, dto);
  }
}
```

**Controller checklist:**

- [ ] `@ApiTags` matches route name
- [ ] `@ApiBearerAuth()` on protected controllers
- [ ] `@ApiOperation` on every route
- [ ] `@ApiResponse` for 200/201 and error codes
- [ ] Controller only calls service methods — never Prisma directly
- [ ] Always pass `orgId` from `@CurrentUser()` to service (never trust URL param for tenant scoping)
- [ ] Sensitive write paths consider audit logging and idempotency expectations

---

## Service Rules

```typescript
/**
 * Manages <feature> data for a given organization.
 * Handles CRUD operations and business rules.
 */
@Injectable()
export class FeatureService {
  private readonly logger = new Logger(FeatureService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Read operations ─────────────────────────────

  /**
   * Returns all features for the given organization.
   * Results are ordered by creation date descending.
   */
  async list(orgId: string): Promise<Feature[]> {
    return this.prisma.feature.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Write operations ────────────────────────────

  /**
   * Creates a new feature under the given organization.
   * @throws ConflictException if a feature with the same name already exists
   */
  async create(orgId: string, dto: CreateFeatureDto): Promise<Feature> {
    const exists = await this.prisma.feature.findFirst({
      where: { orgId, name: dto.name },
    });
    if (exists) throw new ConflictException('A feature with this name already exists');

    return this.prisma.feature.create({
      data: { ...dto, orgId },
    });
  }

  // ─── Internal helpers ────────────────────────────

  private async validateOwnership(orgId: string, featureId: string): Promise<Feature> {
    const feature = await this.prisma.feature.findFirst({
      where: { id: featureId, orgId },
    });
    if (!feature) throw new NotFoundException('Feature not found');
    return feature;
  }
}
```

**Service checklist:**

- [ ] Class-level JSDoc describing purpose
- [ ] JSDoc on every public method
- [ ] Section dividers between logical groups
- [ ] `private readonly logger = new Logger(FeatureService.name)`
- [ ] Throw typed NestJS exceptions only
- [ ] `validateOwnership` helper for any operation that touches a specific entity
- [ ] Do not reach into another module's private assumptions or duplicate its business rules
- [ ] Critical write flows define observable success/failure behavior

---

## DTO Rules

```typescript
// DTO for creating a new feature.
export class CreateFeatureDto {
  @ApiProperty({ description: 'Display name of the feature', example: 'Priority Queue' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'Optional description', example: 'For VIP customers' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
```

**DTO checklist:**

- [ ] `@ApiProperty` or `@ApiPropertyOptional` on every field
- [ ] `@IsOptional()` before other validators on optional fields
- [ ] Always validate string length with `@MaxLength`
- [ ] Comments describe what the DTO is for

---

## Registration in app.module.ts

Always add new modules to `packages/api/src/app.module.ts` imports array in alphabetical order:

```typescript
imports: [
  AnnouncementModule,
  AppointmentModule,
  AuthModule,
  BillingModule,
  BranchModule,
  DeskModule,
  DisplayModule,
  FeatureModule,  // ← your new module here, alphabetically
  NotificationModule,
  ...
]
```

---

## Multi-tenant Security Pattern

**Every** query that touches a resource MUST scope it to `orgId`. Never query by ID alone:

```typescript
// ✅ CORRECT — scoped to org
const ticket = await prisma.ticket.findFirst({ where: { id, orgId } });

// ❌ WRONG — exposes data across tenants
const ticket = await prisma.ticket.findUnique({ where: { id } });
```

## Enterprise-grade additions

### Auditability

- Mutations that affect permissions, billing, destructive actions, or queue overrides should produce an auditable record.
- Include actor, organization, action, target resource, and timestamp.

### Idempotency and retries

- If an endpoint can be retried safely by clients, design for idempotency.
- If an endpoint is intentionally non-idempotent, document the expected retry behavior.

#### Ticket / workbench actions (status-based)

| Action                         | Idempotent when            | Notes                                                                   |
| ------------------------------ | -------------------------- | ----------------------------------------------------------------------- |
| `serve`                        | Ticket already `serving`   | Returns current ticket (no error).                                      |
| `complete` (workbench/classic) | Ticket already `completed` | Returns current ticket; does **not** issue the next journey step again. |
| `no_show`                      | Ticket already `no_show`   | Returns current ticket.                                                 |
| `recall`                       | Not idempotent by status   | Re-call when already `called` refreshes `calledAt` / SMS by design.     |

Prefer **structured error codes** (not message parsing) for invalid transitions. Responses use `GlobalExceptionFilter` shape:

```json
{
  "success": false,
  "error": {
    "code": "TICKET_INVALID_TRANSITION",
    "message": "Ticket is in completed state, expected called or serving",
    "details": {
      "currentStatus": "completed",
      "allowedStatuses": ["called", "serving"],
      "targetStatus": "completed"
    }
  }
}
```

Codes live in `packages/shared/src/constants/ticket-errors.ts`:

| Code                        | Meaning                                                                                                               |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `TICKET_INVALID_TRANSITION` | `currentStatus` not in `allowedStatuses` for the requested transition                                                 |
| `TICKET_ALREADY_TERMINAL`   | Reserved for explicit terminal-state guards (optional; transitions use `TICKET_INVALID_TRANSITION` + `details` today) |

Journey workbench UI treats `TICKET_INVALID_TRANSITION` with a terminal `currentStatus` as a benign double-click (refresh only). See `apps/web/src/lib/workbench-errors.ts`.

### Observability

- Critical module flows should log enough structured context to diagnose failures without leaking secrets or unnecessary PII.
- Prefer correlation IDs for requests that fan out into jobs or external integrations.

### Reporting separation

- Do not let reporting concerns distort core CRUD services.
- If a module needs high-volume or aggregate queries, consider a dedicated read/query service.

---

## Background Jobs (BullMQ)

When adding a new background job:

1. Create a queue name constant in `packages/shared/src/constants/`
2. Add the BullMQ queue to `app.module.ts` BullModule.registerQueue list
3. Processor class goes in `packages/api/src/modules/<feature>/<feature>.processor.ts`
4. Always handle job failure with `this.logger.error()`

---

## Response Envelope

All API responses from this service follow this envelope (enforced by `GlobalExceptionFilter`):

```typescript
// Success
{ "success": true, "data": <payload> }

// Paginated success
{ "success": true, "data": [...], "meta": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 } }

// Error
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Ticket not found" } }
```

Do not wrap responses manually in controllers — NestJS interceptors handle this.
