# QlessQ Support & AI-Assisted Operations

Internal runbook for platform operators. **Not published to tenants.** Supports DPA commitments (documented tenant instructions, least privilege, auditability) when using AI-assisted development tools (Cursor and comparable copilots) for engineering and customer support.

## Scope

This policy covers:

- Production investigation and remediation requested by a tenant organization.
- Use of AI copilots and LLM-backed IDE tools to develop, debug, and operate the Service.
- Access to hosting, database, and application configuration (including values from production `.env` files when required to diagnose or fix an issue).

It does **not** replace executed contract language or the public Privacy Policy, DPA overview, or subprocessor register.

## Default minimization

By default, avoid putting **organization Customer Data** or unrelated tenants’ information into AI tools. Share the **minimum** needed for the task. Routine product development should use repository code and local or staging environments without production patron PII.

When a tenant-specific or production task requires it (see below), document the request and scope first.

## Authorized support work

Perform production data access or changes only when **all** of the following are true:

1. **Documented request** — A verified tenant contact (account owner, admin, or authorized support channel) asks for the action in writing (support ticket, email, or in-app support thread). Capture ticket ID and date.
2. **Scope** — Record `orgId` (organization ID), what to read or change, and why. Do not access unrelated tenants.
3. **Least privilege** — Prefer read-only database access for investigation. Use write access only to complete the approved change.
4. **Preferred tooling** — Use platform admin surfaces, audited API flows, or version-controlled scripts in `packages/database/scripts/` when they exist. Ad-hoc SQL or direct row edits are allowed when necessary to fulfill the approved request, but must still be logged (see Audit).

## Platform engineering (structural changes)

Schema and platform work does not always involve a single tenant ticket, but still follows least privilege and audit discipline:

- **Database structure** — Migrations, new columns, indexes, configuration fields, and similar changes may be performed with full database access (including via Prisma MCP, CLI, or connection strings in local `.env`). Prefer migrations in `packages/database` over ad-hoc production DDL when possible.
- **Application configuration** — Production `.env` values and hosting credentials may be shared with AI tools when required to deploy, migrate, or fix the platform.
- **Minimize live PII** — Structural work should use schema definitions, migration SQL, and sample non-production data when feasible; avoid pasting bulk tenant or patron rows unless needed to validate a change.

## Tenant-specific customization and data changes

When a tenant asks for work scoped to their organization (examples: update a row, adjust a setting, customize UI or panel behavior for a **specific staff email** or user in their account):

1. Obtain a **documented request** from an authorized tenant contact (ticket or email).
2. Record **`orgId`**, the **scope** (what to change and for whom), and identifiers needed to implement it (for example a staff **email address**, `userId`, or record id). Passwords are never shared with AI tools.
3. Implement via admin UI, API, migration, or targeted SQL as appropriate; log the action (see Audit).

Identifiers such as a tenant staff email used only to scope a customization for that tenant’s authorized request are permitted in AI sessions when necessary to build or apply the change.

## AI-assisted operations

We use **AI development and support platforms** (for example Cursor and other comparable copilots) and their underlying model providers as subprocessors. See the public subprocessor register at `/subprocessors`.

### Allowed in AI sessions (with safeguards)

| Data type                                                              | Allowed when                             | Notes                                                                                                                                                              |
| ---------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Source code in the repository                                          | Routine development                      | Default vibe-coding / feature work. Allowed under standard terms/training-enabled settings.                                                                        |
| Production configuration (`.env` values, API keys, connection strings) | Troubleshooting or deploy fixes          | May be pasted into AI tools when needed to resolve hosting, database, or integration issues. Rotate or restrict credentials if exposure is broader than necessary. |
| Database schema and migrations                                         | Platform engineering                     | Table/column changes, new fields, indexes, Prisma migrations; may use full database access without bulk patron PII when structure alone is sufficient.             |
| Single or small sets of database rows                                  | Tenant-approved support request          | Example: locate or update a specific ticket, appointment, or user row. Allowed ONLY in sessions with verified Privacy Mode / zero-training settings enabled.       |
| Tenant-scoped identifiers (e.g. staff email, user id, org id)          | Tenant-approved customization or support | Example: customize panel behavior for one staff member. Allowed ONLY in sessions with verified Privacy Mode / zero-training settings enabled.                      |
| Aggregated or redacted diagnostics                                     | Investigation                            | Prefer counts, IDs, and non-sensitive fields over full patron PII.                                                                                                 |

### Not allowed in AI sessions

| Data type                             | Reason                                                                                                                                       |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| End-user passwords or password hashes | Not required for support; we do not disclose credentials to AI tools. Authentication secrets are not shared in chat.                         |
| Bulk exports of Customer Data         | Use controlled admin/export paths; do not paste large tables into AI chat.                                                                   |
| Unrelated tenants’ data               | Cross-tenant access violates isolation commitments unless explicitly required for platform security incident response (document separately). |

### Tooling hygiene

- **Privacy Mode for Customer Data** — Privacy Mode (or equivalent zero-retention / no-training settings) must stay enabled on AI copilot accounts whenever they are used to process Customer Personal Data (PII), database row content, or tenant support tickets.
- **Development & Coding** — For general software coding, development, and repository work (where no Customer Personal Data or PII is submitted), developers may use AI tools under standard terms (which may include model training / standard retention).
- **Tooling hygiene & Minimization** — Avoid pasting actual customer database rows, customer PII, or support logs into any AI tool unless that specific tool is verified to have zero-retention/zero-training enabled. Use **MCP, CLI, and local `.env`** where possible so secrets are not repeated in chat more than necessary.
- After incidents involving credential paste into AI tools, consider **rotating** exposed keys if the vendor policy or risk assessment warrants it.

## Audit and logging

When performing tenant-requested changes:

1. Reference the **support ticket** in commit messages, runbooks, or internal notes.
2. Record material actions in **`PlatformAuditEvent`** (or successor platform audit tables) when the change is performed through platform admin or instrumented scripts.
3. For direct database edits, note: operator, timestamp, `orgId`, table/record identifiers, and summary of change in the ticket.

## Escalation

- Suspected data breach or cross-tenant leak: follow `INCIDENT_RESPONSE_RUNBOOK.md`.
- Legal or DSAR requests: coordinate with legal contact; use DSAR/anonymization workflows rather than ad-hoc AI-assisted deletion unless approved.

## Review

- **Owner:** Platform engineering + legal
- **Cadence:** Review quarterly or when adding a new AI vendor, CRM, or changing production access patterns
- **Last updated:** 2026-06-04
- **See also:** `COMPLIANCE_NEXT_STEPS.md` for vendor adoption, subprocessor notice, and counsel review checklist
- **Related:** `AUDIT_EVIDENCE_PACK.md` for enterprise audit packaging
