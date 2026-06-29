# QlessQ Admin Dashboard: Transactional Compliance Architecture Plan

> **QMS sibling repo:** References to `apps/web` or `apps/admin` describe the **QlessQ** queue product in the sibling `../QMS` repository — not Patron Loyalty (`apps/loyalty`). See [REPO_BOUNDARIES.md](../architecture/REPO_BOUNDARIES.md).

This document outlines the Super-Admin compliance controls, routing, schema expansions, and UI/UX guidelines required to govern multi-tenant transactional SMS, email, and privacy behaviors across all markets (US, Canada, International). It is designed as a direct handoff specification for implementation.

---

## 🗺️ Next.js Route Matrix (`apps/admin`)

To integrate these controls seamlessly into the existing Next.js App Router workspace, implement the following routes under `apps/admin/src/app/(dashboard)`:

```text
apps/admin/src/app/(dashboard)/
├── compliance/
│   ├── page.tsx                  # Transactional Compliance & Health Dashboard
│   ├── a2p-10dlc/
│   │   ├── page.tsx              # Brand & Campaign Verification Queue
│   │   └── [id]/page.tsx         # Detailed Tenant Campaign Review & Mediation
│   ├── dsar/
│   │   └── page.tsx              # Universal Right-to-be-Forgotten & DSAR Console
│   ├── CMS/
│   │   ├── page.tsx              # Dynamic SMS Disclosures CMS
│   │   └── [policyId]/page.tsx   # Disclosure Editor & Acceptance Auditor
│   └── ledger/
│       └── page.tsx              # Immutable Suppression Registry & Audit Search
```

---

## 🛠️ Database Schema Expansions (`schema.prisma`)

Expand the Prisma schema to support transactional suppression management, versioned SMS disclosures, and carrier tracking globally:

```prisma
// 1. Centralized Opt-Out & Suppression Ledger
model UniversalSuppression {
  id           String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  hashedValue  String    @unique @map("hashed_value") @db.VarChar(64) // SHA-256 of +1XXXXXXXXXX or email
  identifier   String?   @db.VarChar(255) // Optional, heavily masked value for UI display
  type         String    @db.VarChar(20)  // "phone" | "email"
  reason       String    @db.VarChar(50)  // "STOP" | "BOUNCE" | "DSAR" | "MANUAL"
  createdAt    DateTime  @default(now()) @map("created_at")
  scope        String    @default("global") @db.VarChar(20) // "global" (all tenants) | "tenant_specific"
  subjectOrgId String?   @map("subject_org_id") @db.Uuid // Null if global suppression
  actorUserId  String?   @map("actor_user_id") @db.Uuid

  @@index([hashedValue])
  @@index([type, reason])
  @@map("universal_suppressions")
}

// 2. Platform-wide SMS Disclosure CMS
model PlatformDisclosure {
  id                    String            @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  documentType          String            @map("document_type") @db.VarChar(50) // "SMS_DISCLOSURE" | "TOS"
  version               String            @db.VarChar(20) // E.g., "2026.1"
  title                 String            @db.VarChar(200)
  content               String            @db.Text
  isActive              Boolean           @default(false) @map("is_active")
  createdAt             DateTime          @default(now()) @map("created_at")
  updatedAt             DateTime          @updatedAt @map("updated_at")

  @@unique([documentType, version])
  @@index([isActive])
  @@map("platform_disclosures")
}

// 3. Brand & A2P 10DLC Campaign Registry
model A2PCampaign {
  id             String       @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  orgId          String       @unique @map("org_id") @db.Uuid
  brandName      String       @map("brand_name") @db.VarChar(100)
  ein            String       @db.VarChar(20)
  website        String       @db.VarChar(255)
  vertical       String       @db.VarChar(50)
  useCase        String       @map("use_case") @db.VarChar(50) // Purely Transactional (Customer Service / Alerts)
  sampleMsg1     String       @map("sample_msg_1") @db.VarChar(500)
  sampleMsg2     String       @map("sample_msg_2") @db.VarChar(500)
  optInProofUrl  String       @map("opt_in_proof_url") @db.VarChar(500)
  status         String       @default("draft") @db.VarChar(30) // "draft" | "pending_platform" | "submitted" | "approved" | "rejected"
  rejectionCode  String?      @map("rejection_code") @db.VarChar(100)
  carrierFeeCents Int         @default(0) @map("carrier_fee_cents")
  createdAt      DateTime     @default(now()) @map("created_at")
  updatedAt      DateTime     @updatedAt @map("updated_at")
  organization   Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@map("a2p_campaigns")
}
```

---

## ⚡ API Endpoint Blueprint (`packages/api`)

Expose administrative operations through a NestJS compliance controller (`platform-admin/compliance` router) with double-authentication and role verification:

```typescript
@UseGuards(PlatformAdminAuthGuard, PlatformAdmin2FAGuard, RolesGuard)
@Roles('compliance_officer', 'super_admin')
@Controller('platform-admin/compliance')
export class ComplianceController {

  // Pillar 1: Global Health & Risk
  @Get('risk-analytics')
  async getRiskAnalytics(): Promise<ComplianceRiskAnalyticsDto>;

  // Pillar 2: A2P Campaign Approvals
  @Get('a2p/campaigns')
  async listCampaigns(@Query() query: PaginationQueryDto);

  @Patch('a2p/campaigns/:id/status')
  async updateCampaignStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCampaignStatusDto
  );

  // Pillar 3: Universal DSAR & Redaction
  @Post('dsar/search')
  async searchHashedIdentifier(@Body() dto: DsarLookupDto);

  @Post('dsar/execute')
  @AuditLog({ eventType: 'DSAR_EXECUTION_COMPLETED', severity: 'critical' })
  async executeRightToBeForgotten(@Body() dto: DsarExecuteDto);

  // Pillar 4: Disclosures CMS
  @Post('disclosures')
  async createDisclosureVersion(@Body() dto: CreateDisclosureDto);

  @Patch('disclosures/:id/activate')
  async activateDisclosure(@Param('id') id: string);

  // Pillar 5: Suppression Registry
  @Post('suppressions/blacklist')
  async manuallySuppress(@Body() dto: AddSuppressionDto);

  @Delete('suppressions/:hashedValue')
  async liftSuppression(@Param('hashedValue') hashedValue: string);
}
```

---

## 💎 Super-Admin Compliance Modules

### 📈 Module 1: Global Health & Risk Dashboard

- **Purpose:** Prevent platform shutdown by monitoring carriers' standard opt-out, block, and delivery thresholds dynamically.
- **UI Elements:**
  - **Carrier Limit Alerts:** Interactive status rings flagging any tenant with an SMS bounce rate above `3%` or `STOP` opt-out rate above `1%` in a 24-hour moving window.
  - **Bulk Queue Toggles:** Admin buttons to pause, throttle, or sandbox a tenant’s transactional alerts queue inside BullMQ directly from the interface.

### 🏷️ Module 2: A2P 10DLC Brand & Campaign Verification Portal

- **Purpose:** Control and verify brand registries for Purely Transactional campaign numbers to safeguard the platform's collective rating.
- **UI Elements:**
  - **Vetting Queue Kanban:** Tracing tenant verification states from drafts to active registrations.
  - **Footer Compliance Inspector:** Split-screen tool viewing a tenant's active check-in kiosk layout or booking screen alongside E.164 disclosures.

### 🛡️ Module 3: Universal DSAR & Right-to-be-Forgotten Orchestrator

- **Purpose:** Securely execute GDPR/CCPA data purges globally without exposing raw PII.
- **UI Elements:**
  - **Two-Factor Verification Ring:** Restricting action buttons until a separate TOTP code is entered (using the `adminTwoFactorEnabled` field on the administrative user).
  - **Search Hashed Field:** Transforms emails/phones into SHA-256 in-browser before lookup, checking all matching database indexes across the monorepo.
  - **Cascade Visualizer:** An interactive status stepper displaying exactly where the purge is in-flight:
    1.  Locating postgres records (Tickets, Visits, Customers).
    2.  Clearing cache logs in Redis (BullMQ schedules).
    3.  Injecting `REDACTED_BY_DSAR` and dropping email/phone columns.
    4.  Pushing final hashed token into the `UniversalSuppression` ledger.
  - **Legal Hold Toggle:** Clear indicators showing if any related ticket has `legalHold: true` active, blocking any execution of a DSAR cascade to prevent illegal evidence deletion.

### 📜 Module 4: Dynamic Disclosures CMS

- **Purpose:** Govern global transaction-based legal disclosures across all tenant checkout forms.
- **UI Elements:**
  - **Disclosure Markdown Workspace:** Editor for localized checkout disclosures (e.g., standard TCPA/CASL wording for SMS queue check-ins).
  - **Release Mechanism:** Dynamic toggle to push disclosure versions immediately to kiosk endpoints (`apps/web`).

### 📋 Module 5: Transactional Suppression Ledger Panel

- **Purpose:** Complete read/write log monitoring platform blocklists.
- **UI Elements:**
  - **Real-time Ledger Trail:** Clean table showing blocked targets, carrier bounce status, and opt-out (`STOP`) events.
  - **Compliance Override controls:** Access controls allowing authorized staff to force-blacklist spam numbers or release mistakenly blocked transactional emails/numbers.

---

## 🎨 Design & Accessibility (UI/UX) Requirements

Super-admin tools demand the exact same visual quality and responsiveness as customer-facing kiosks. Follow these guidelines to build premium controls:

1.  **Strictly Minimalist Dark Aesthetics:** Use Tailwind's deep slate hues (`bg-slate-900`, `text-slate-100`) layered with subtle, glassmorphic card elements (`bg-white/5 backdrop-blur-md border-white/10`) to indicate sensitive compliance actions.
2.  **High-Severity Micro-Animations:** Destructive processes (like executing DSARs) must use warning animations (e.g., pulsing red rings, countdown delays, and confirm sliders) to eliminate accidental data deletion.
3.  **Complete PII Masking:** Hide sensitive database fields by default. Clicking the search target's email or phone triggers a high-severity `PlatformAuditEvent` showing that admin `actorEmail` reviewed the data, requiring an explicit confirmation modal first.
4.  **A11y Conformance:** Full keyboard navigation support (tabs, focus indicators) and complete screen-reader labeling for high-priority dashboards.
