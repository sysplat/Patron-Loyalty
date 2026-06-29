# QMS Global Compliance Program: Consolidated Master Plan

> **QMS sibling repo:** References to `apps/web` or `apps/admin` describe the **QlessQ** queue product in the sibling `../QMS` repository — not Patron Loyalty (`apps/loyalty`). See [REPO_BOUNDARIES.md](../architecture/REPO_BOUNDARIES.md).

This document serves as the absolute, production-grade technical specification for the implementation of the **QlessQ (QMS) Global Compliance Program**. It weaves core compliance objectives with advanced architectural enhancements and super-admin dashboard integrations, making default behavior legally conservative across US, Canada, and international markets while preserving tenant flexibility behind strict guardrails.

---

## Implementation Status Snapshot

- **Implemented now**
  - Explicit SMS consent capture in kiosk/booking flows (no implicit default-on semantics).
  - Server-side enforcement: SMS requires explicit consent plus a valid E.164-capable phone.
  - STOP/UNSUBSCRIBE/ARRET inbound handling with suppression ledger writes.
  - Org-scoped SMS consent audit retrieval endpoint and activity logging for capture/update events.
  - Canada-facing legal language hardening in tenant and patron legal content.
- **Planned next**
  - Marketing-specific double opt-in lifecycle (`PENDING_VERIFICATION`/`GRANTED`/`REVOKED`).
  - Full immutable consent ledger model beyond operational activity logs.
  - Locale-aware consent UX and advanced regional policy controls.

---

## Published legal baseline (2026-06-04)

This document is an **engineering roadmap** for SMS, consent, and super-admin compliance features. It does **not** replace published legal artifacts. Counsel and customers should rely on the public pages and their TypeScript sources:

| Artifact              | Public URL        | Source file                                      |
| --------------------- | ----------------- | ------------------------------------------------ |
| Terms of Service      | `/terms`          | `apps/web/src/content/legal/terms-of-service.ts` |
| Privacy Policy        | `/privacy`        | `apps/web/src/content/legal/privacy-policy.ts`   |
| Patron privacy notice | `/patron-privacy` | `apps/web/src/content/legal/patron-privacy.ts`   |
| Patron terms          | `/patron-terms`   | `apps/web/src/content/legal/patron-terms.ts`     |
| DPA overview          | `/dpa`            | `apps/web/src/content/legal/dpa-overview.ts`     |
| Subprocessor register | `/subprocessors`  | `apps/web/src/content/legal/subprocessors.ts`    |

**Also in effect (2026-06-04):** no sale of personal information; AI-assisted development and support subprocessors disclosed; CRM/analytics category (internal analysis only, when used); patron and tenant legal version constants in `packages/shared/src/constants/legal.ts`.

**Internal ops and counsel handoff:**

- `docs/compliance/SUPPORT_OPERATIONS.md` — AI-assisted support, production access, Privacy Mode when handling Customer Data
- `docs/compliance/COUNSEL_REVIEW_BRIEF.md` — attorney review questions and file list
- `docs/compliance/COMPLIANCE_NEXT_STEPS.md` — operator checklist and sync workflow

**Admin portal spec (future UI for this program):** `docs/compliance/ADMIN_DASHBOARD_COMPLIANCE.md`

---

## 🏛️ Core Architectural Standards

All workstreams must align with these high-level architectural requirements:

1. **Strictest-by-Default (SBD):** Automatically apply the most restrictive privacy and regulatory controls (e.g., CASL, TCPA, GDPR) to a recipient based on their target country code unless explicit, documented opt-in events exist.
2. **Immutable Consent History:** Every opt-in, opt-out, policy agreement, and suppression state change must be written to an append-only ledger that cannot be altered or deleted.
3. **Hashed PII Protection:** Contact details (phone numbers, emails) in global blacklists must be stored using cryptographically salted SHA-256 hashing to prevent global PII exposure while maintaining indexing capability.
4. **Deterministic Phone Normalization:** To prevent silent suppression failures, phone numbers MUST be normalized to strict E.164 format (using `google-libphonenumber`) before computing SHA-256 hashes. A single variation in punctuation or country codes breaks hash matching.
5. **🛡️ SaaS Operational Telemetry Shield (Standard B2B/B2C SaaS Operations):**
   - To maintain platform security, optimize queue operations, and ensure dashboard responsiveness, all standard SaaS telemetry remains active by default.
   - This includes: setting session cookies (for auth and preference states), caching device telemetry (IP address, user-agent), tracking geographic metadata (branch locations, timezones, queue schedules), and keeping administrative action logs (`ActivityLog`, `PlatformAuditEvent`).
   - **Legal Protection:** These operational items are legally classified under "Legitimate Business Interest" and "System Security" (GDPR/CCPA/PIPEDA). They are **exempt** from consumer opt-out suppression gates and are explicitly shielded from DSAR cascades to prevent breaking system stability.

---

## 🗺️ Workstream Specifications

### 🗄️ Workstream 1: Consent & Preferences Domain Model

Extend the database consent model beyond current simple SMS flags to support channel-specific and purpose-specific consent states (transactional, marketing, reminders) backed by immutable logs and high-security suppression ledgering.

#### Key Architectural Requirements:

- **Double Opt-In (DOI) Lifecycle:** Introduce a `consent_status` enum (`PENDING_VERIFICATION`, `GRANTED`, `REVOKED`) for non-transactional marketing campaigns. Double Opt-In is mandatory for CASL (Canada) and strict European regions (Germany).
- **Salted suppression Ledger:** Implement a `UniversalSuppression` model to store durable opt-out events (`STOP` webhooks, portal actions, or manual admin suppressions).
- **Cryptographic Anonymization:** Raw email strings and phone numbers must not be stored in the immutable consent ledger permanently, adhering to GDPR/CCPA "Right to Be Forgotten" guidelines. Instead, identify records using cryptographically salted SHA-256 hashes.

#### Primary Files:

- `packages/database/prisma/schema.prisma`
- `packages/database/prisma/migrations/`
- `packages/shared/src/validators/notification.validators.ts`

---

### Canada Tenant Onboarding Checklist (Operational)

Before enabling SMS for a Canadian-serving tenant:

1. Set organization profile fields required for SMS compliance checks (`website`, `country`, `industry`).
2. Confirm branch/operator flows use explicit SMS opt-in (no preselected consent).
3. Confirm legal disclosure references message frequency, rates, and STOP/HELP behavior.
4. Validate support can retrieve consent evidence via org-scoped consent audit logs.
5. Validate inbound STOP/ARRET path by sending a test message through the webhook path.

---

### 📥 Workstream 2: Inbound Opt-Out Automation (Highest Operational Risk)

Build highly resilient inbound webhook infrastructure that captures and processes opt-out keywords instantaneously, halting any further communications.

#### Key Architectural Requirements:

- **Multilingual Keyword Normalization:** Twilio webhook endpoint must parse and normalize standard English/French keywords: `STOP`, `UNSUBSCRIBE`, `ARRET`, `QUIT`, `CANCEL`.
- **Deterministic Suppressions:** Automatically lookup customer records by normalizing the sender's phone number into E.164, hash it, write the hash to `UniversalSuppression`, and change effective database consent models.
- **Carrier Confirmation Messages:** Instantly dispatch required opt-out confirmation SMS replies (e.g., _"You have been opted out of QMS updates. No more messages will be sent. Reply START to join again."_).

#### Primary Files:

- `packages/api/src/modules/notification/notification.controller.ts`
- `packages/api/src/modules/notification/notification.service.ts`
- `packages/notifications/src/providers/sms.provider.ts`

---

### ⚙️ Workstream 3: Send-Time Outbound Policy Engine

Create a centralized outbound gatekeeper through which all notifications (SMS and Email) must pass before hitting Twilio or SendGrid.

#### Key Architectural Requirements:

- **Consent and Suppression Validation:** Query target recipient hashes against `UniversalSuppression` and validation structures before every single send.
- **Resilient Quiet Hours Deferral:** For non-urgent messaging during quiet hours (e.g., feedback reviews, promotional flyers), utilize BullMQ delay offsets to reschedule delivery to the next morning, rather than silently dropping the message.
- **Volume & Frequency Capping:** Implement limits to prevent infinite-loop bugs or SMS spam reports:
  - _Marketing notifications:_ Max 1 message per recipient every 7 days.
  - _Queue Transactional notifications:_ Max 3 notifications per active visit.

#### Primary Files:

- `packages/api/src/modules/notification/notification.service.ts`
- `packages/api/src/modules/ticket/ticket.service.ts`
- `packages/api/src/modules/appointment/appointment.service.ts`

---

### 📱 Workstream 4: Customer-Facing UX & Legal Disclosures (`apps/web`)

Upgrade customer kiosks, online booking screens, and public tracking portals to incorporate locale-aware legal standards and granular subscription controls.

#### Key Architectural Requirements:

- **Locale-Aware Consent Formats:** Inject dynamic footer agreements based on user locale or branch location (e.g., explicit marketing checkboxes for TCPA in the US, separate Double Opt-In activation modules for CASL in Canada).
- **Double Opt-In (DOI) Verification Flow:** Create a lightweight customer OTP flow sending a 6-digit verification code to validate marketing opt-ins. Set verification token TTL to exactly 15 minutes.
- **Granular Preference Dashboard:** A tab inside the customer tracking interface where users can select channel choices (SMS vs. Email) or revoke marketing consent at will.

#### Primary Files:

- `apps/web/src/app/(kiosk)/kiosk/[branchId]/page.tsx`
- `apps/web/src/app/(kiosk)/book/[branchId]/page.tsx`
- `apps/web/src/app/(track)/`

---

### ✉️ Workstream 5: Email Compliance Parity

Implement identical legal strictness for email campaigns, ensuring zero parity gaps between email and mobile delivery channels.

#### Key Architectural Requirements:

- **Unsubscribe Primitives:** Inject deterministic unsubscribe links/tokens in the footer of all marketing emails. Clicking the link must instantly write to `UniversalSuppression`.
- **Tenant Footer Content:** Force dynamic injection of the sending tenant's legal corporate address and physical contact details inside email templates to fulfill standard CAN-SPAM requirements.

#### Primary Files:

- `packages/api/src/modules/notification/notification.service.ts`
- `packages/notifications/src/providers/email.provider.ts`

---

### 🏷️ Workstream 6: Tenant Controls & Onboarding Gates

Introduce configuration dashboards letting individual tenants fine-tune legal details, restricted by platform-wide compliance gates.

#### Key Architectural Requirements:

- **A2P 10DLC State Machine:** Model dynamic brand registration states: `UNREGISTERED` -> `PENDING` -> `APPROVED` -> `REJECTED`/`SUSPENDED`.
- **Status-based Queue Throttling:**
  - _Unregistered/Pending Brand:_ Restrict outbound SMS flow to standard unregistered carrier volumes (e.g., max 1 segment per second).
  - _Rejected/Suspended Brand:_ Completely lock outbound SMS capability instantly inside the policy engine.
- **Tenant Controls:** Settings for locale overrides, localized quiet hours configuration (enforcing quiet hours based on target branch timezone metadata), and custom notification templates.

#### Primary Files:

- `apps/web/src/app/(dashboard)/dashboard/settings/page.tsx`
- `packages/api/src/modules/billing/`
- `packages/api/src/modules/notification/`

---

### 📜 Workstream 7: Governance, Legal CMS, and Audit Exports

Expose secure legal lifecycle records and automated tools to address individual privacy claims.

#### Key Architectural Requirements:

- **Legal Acceptance Ledger:** Track exact acceptance records (`LegalAcceptance`) linking IP addresses, timestamps, browser signatures, and specific document versions.
- **Automated Right-to-be-Forgotten Cascade:** Build a database routine to purge customer PII (replacing names with `REDACTED_BY_DSAR`, removing email/phone strings) across `Customer`, `Ticket`, and `Visit` tables instantly, while inserting their hashed token in the global suppression ledger to block future contacts.
- **Secure Telemetry Isolation:** Explicitly prevent the deletion of operational log records (`ActivityLog`, `PlatformAuditEvent`, session identifiers, timezone metrics) during a customer deletion cascade. These are protected for platform security and debugging purposes.
- **Audit Exports:** Provide secure JSON/CSV export files capturing consent timelines, decision loops, and message dispatch events for dispute mediation.

#### Primary Files:

- `apps/web/src/content/legal/privacy-policy.ts`
- `apps/web/src/content/legal/terms-of-service.ts`
- `docs/compliance/`

---

### 🧪 Workstream 8: Testing & Verification Criteria

Implement robust integration and end-to-end verification files to guard against future regressions.

#### Key Architectural Requirements:

- **Unit & Integration Coverage:** Add backend specs testing STOP webhook triggers, suppression list matches, frequency caps, and quiet-hour deferrals.
- **E2E Scenarios:** Implement Playwright scripts in `apps/e2e` simulating customer kiosks check-ins, validation codes, and tracking updates across multiple mock branch jurisdictions.
- **Policy Engine Block checks:** Ensure 100% of SMS/Email triggers route through the policy engine by establishing linters or architecture guards preventing direct provider calls.

#### Primary Files:

- `packages/api/src/modules/notification/notification.service.spec.ts`
- `packages/api/src/modules/notification/notification-ticket-sms.spec.ts`
- `apps/e2e/`

---

### 👑 Workstream 9: Super-Admin Governance Portal (`apps/admin`)

Empower global administrators with top-level monitoring tools to safeguard the entire multi-tenant infrastructure.

#### Key Architectural Requirements:

- **Real-time Risk Monitor:** Dynamic dashboards highlighting tenants with delivery issues, high bounce rates, or spike thresholds triggering policy caps. Include standard telemetry tools like active user session tracking and geographic branch metadata widgets.
- **Brand Vetting Queue:** Kanban board letting super-admins inspect, verify, and approve/reject tenant EIN entries and opt-in disclosure templates before downstream carrier registration.
- **Multi-Factor Authenticated DSAR Purge Console:** Restrict direct deletion toolpages to administrators with active 2FA. The lookup utility transforms phone/email queries into cryptographically salted SHA-256 tokens before checking databases.
- **Legal Policy Versioning CMS:** Admin console to draft, preview, and release revised policy versions globally. Includes check toggles to force re-acceptance prompts on customer apps.

---

## 🚀 Execution & Rollout Sequence

To execute this program safely and avoid service interruptions, implement in the following recommended order:

```text
[1] Database Schema Upgrades & Salted Consent Ledger
  │
  ├───► [2] Inbound STOP Webhook & Identity Matching
  │
  ├───► [3] Central Send-Time Outbound Policy Engine
  │
  ├───► [4] Kiosk, Online Booking & Tracking UX updates (DOI, preference dashboards)
  │
  ├───► [5] Email Parity, Footers & Unsubscribe links
  │
  ├───► [6] Tenant Controls, Quiet Hours Overrides & A2P State Throttlers
  │
  ├───► [7] Super-Admin Governance Portal (Risk maps, 10DLC portal, DSAR purger)
  │
  └───► [8] End-to-end Testing Coverage, Playwright Scenarios & CI Release gates
```
