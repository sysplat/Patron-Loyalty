# Compliance Next Steps (Internal)

Operational checklist after legal document updates. **Not published to tenants.**

## Source of truth for published legal pages

| Public page       | Authoritative source                             | Version constant                             |
| ----------------- | ------------------------------------------------ | -------------------------------------------- |
| `/terms`          | `apps/web/src/content/legal/terms-of-service.ts` | `CURRENT_TERMS_VERSION`                      |
| `/privacy`        | `apps/web/src/content/legal/privacy-policy.ts`   | `CURRENT_PRIVACY_VERSION`                    |
| `/patron-privacy` | `apps/web/src/content/legal/patron-privacy.ts`   | `CURRENT_PATRON_PRIVACY_VERSION`             |
| `/patron-terms`   | `apps/web/src/content/legal/patron-terms.ts`     | `CURRENT_PATRON_TERMS_VERSION`               |
| `/dpa`            | `apps/web/src/content/legal/dpa-overview.ts`     | (same bump cadence as privacy when material) |
| `/subprocessors`  | `apps/web/src/content/legal/subprocessors.ts`    | (same bump cadence as privacy when material) |

**Markdown mirrors** (`docs/compliance/DPA_OVERVIEW.md`, `SUBPROCESSORS.md`) are counsel-friendly copies. After editing the `*.ts` files, sync the markdown mirrors and bump versions in `packages/shared/src/constants/legal.ts`.

## Immediate (operator)

1. **Counsel review** — Use `COUNSEL_REVIEW_BRIEF.md` when engaging qualified legal counsel to review `/terms`, `/privacy`, `/patron-privacy`, `/patron-terms`, `/dpa`, and `/subprocessors` before relying on them in customer contracts. Apply counsel redlines in `apps/web/src/content/legal/*.ts` and bump legal versions.
2. **Deploy published legal pages** — Ensure production serves the latest `CURRENT_*_VERSION` dates from `packages/shared/src/constants/legal.ts`.
3. **AI tooling hygiene** — **Privacy Mode enabled** on AI copilot accounts when processing Customer Data (confirmed 2026-06-04). Re-verify when adding new tools or team members; follow `SUPPORT_OPERATIONS.md`.
4. **No sale policy** — Do not sell, rent, or trade personal information. CRM or analytics tools are for **internal analysis and relationship management only**; update `/subprocessors` with the vendor name when a CRM is adopted.

## When adopting a new vendor

1. Add the vendor to `apps/web/src/content/legal/subprocessors.ts`, then sync `docs/compliance/SUBPROCESSORS.md`.
2. Bump `CURRENT_PRIVACY_VERSION` (and page `lastUpdated`) when the change is material.
3. Notify organization account owners by email or in-app notice **before** the vendor processes Customer Data, except when security or law requires sooner.
4. Ensure a DPA or equivalent confidentiality terms exist with the vendor.

## When changing Terms or Privacy materially

1. Bump `CURRENT_TERMS_VERSION` and/or `CURRENT_PRIVACY_VERSION` in `packages/shared/src/constants/legal.ts`.
2. Post updated pages; email or in-app notice to organization account owners where appropriate.
3. Plan in-app re-acceptance before large enterprise customers (not yet automated).

## Quarterly

- Review `SUBPROCESSORS.md` (and `subprocessors.ts`) against actual production vendors (Railway, Twilio, Stripe, Redis, Centrifugo, Sentry, CRM if used, AI platforms).
- Review `SUPPORT_OPERATIONS.md` against how support and AI-assisted ops are actually performed.
- Run access review per `CONTINUOUS_ASSURANCE.md`.

## Related artifacts

| Document                        | Purpose                                                       |
| ------------------------------- | ------------------------------------------------------------- |
| `COUNSEL_REVIEW_BRIEF.md`       | Questions and file list for attorney review                   |
| `SUPPORT_OPERATIONS.md`         | AI-assisted support and production access                     |
| `SUBPROCESSORS.md`              | Markdown mirror of public `/subprocessors` (sync from `*.ts`) |
| `DPA_OVERVIEW.md`               | Markdown mirror of public `/dpa` (sync from `*.ts`)           |
| `GLOBAL_COMPLIANCE_PROGRAM.md`  | SMS/consent and super-admin compliance roadmap (engineering)  |
| `ADMIN_DASHBOARD_COMPLIANCE.md` | Future admin compliance portal UI/API spec                    |
| `CONTINUOUS_ASSURANCE.md`       | Recurring security/compliance controls                        |
| `INCIDENT_RESPONSE_RUNBOOK.md`  | Breach and incident handling                                  |
| `AUDIT_EVIDENCE_PACK.md`        | Enterprise audit evidence checklist                           |

**Last updated:** 2026-06-04
