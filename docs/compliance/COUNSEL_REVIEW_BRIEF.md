# Counsel Review Brief — QlessQ (QMS)

**Internal — for qualified legal counsel only.** This brief helps an attorney review our published legal artifacts and internal ops policies. It is not legal advice.

## Product summary

- **Product:** QlessQ — multi-tenant B2B SaaS for queue management, appointments, lobby displays, SMS/email notifications (Twilio/SendGrid), billing (Stripe).
- **Customers:** Organizations (tenants) — clinics, service businesses, etc.
- **End users:** Patrons (walk-ins, kiosk, online booking, track links) — data controlled by the tenant.
- **Roles:** Tenant = data controller (typical). QlessQ = data processor / service provider for patron data.
- **Markets:** US and Canada emphasized in existing copy (CASL, PIPEDA references). Cross-border processing disclosed.
- **Data sale:** We **do not sell, rent, or trade** personal information. CRM/analytics (if adopted) is for internal analysis only.

## Development and support practices (material to review)

- Product built with **AI-assisted development tools** (e.g. Cursor and comparable copilots) and underlying LLM providers — listed as subprocessors.
- **Internal runbook:** `docs/compliance/SUPPORT_OPERATIONS.md` — production support may include:
  - Tenant-documented requests (ticket + org scope)
  - Schema/migration work with database access
  - Production `.env` values in AI tools when needed for troubleshooting
  - Targeted row or staff-email identifiers for authorized customization — **not** passwords/hashes or bulk patron exports
- **Default minimization:** Avoid patron PII in AI chat unless required for an approved task.
- **Privacy Mode:** Required when processing Customer Personal Data (PII) (2026-06-04).

## Published legal artifacts (review these)

| Document                            | Public URL        | Source file                                      | Version    |
| ----------------------------------- | ----------------- | ------------------------------------------------ | ---------- |
| Terms of Service (tenant)           | `/terms`          | `apps/web/src/content/legal/terms-of-service.ts` | 2026-06-04 |
| Privacy Policy (tenant staff/admin) | `/privacy`        | `apps/web/src/content/legal/privacy-policy.ts`   | 2026-06-04 |
| End-User Privacy Notice (patron)    | `/patron-privacy` | `apps/web/src/content/legal/patron-privacy.ts`   | 2026-06-04 |
| End-User Terms (patron)             | `/patron-terms`   | `apps/web/src/content/legal/patron-terms.ts`     | 2026-06-04 |
| DPA overview                        | `/dpa`            | `apps/web/src/content/legal/dpa-overview.ts`     | 2026-06-04 |
| Subprocessor register               | `/subprocessors`  | `apps/web/src/content/legal/subprocessors.ts`    | 2026-06-04 |

**Companion internal docs (not public):**

- `docs/compliance/DPA_OVERVIEW.md` — mirror of public DPA
- `docs/compliance/SUBPROCESSORS.md` — mirror of public register
- `docs/compliance/SUPPORT_OPERATIONS.md` — AI/support ops
- `docs/compliance/GLOBAL_COMPLIANCE_PROGRAM.md` — SMS/consent roadmap
- `docs/compliance/INCIDENT_RESPONSE_RUNBOOK.md`

**Legal contact on site:** `legal@queueplatform.com` (`packages/shared/src/constants/brand.ts`)

**Registration audit:** Signup records `LegalAcceptance` with `CURRENT_TERMS_VERSION` / `CURRENT_PRIVACY_VERSION` (`packages/api/src/modules/auth/auth-registration.service.ts`).

## Subprocessors currently disclosed

Twilio, Twilio SendGrid, Stripe, Railway, PostgreSQL, Redis, Centrifugo, Sentry (when enabled), CRM/analytics (when used), AI dev/support platforms + LLM providers.

## Questions for counsel

### Entity and jurisdiction

1. Is **QlessQ** the correct legal entity name in all documents, or should we use a registered corporate name?
2. Is **§13 Governing Law** (jurisdiction of establishment) correctly stated for our entity?
3. Do we need separate Quebec/French-language artifacts?

### B2B Terms and Privacy (tenants)

4. Are Terms §5 (Customer Data license, support instructions, tenant end-customer notice duty) and §12 (subprocessors) sufficient for our B2B model?
5. Is the **no-sale** language adequate for US state privacy laws (CPRA “sale/share”) and Canadian contexts?
6. Are **limitation of liability** and **indemnity** clauses enforceable for our target markets and plan tiers?
7. Is the **prohibited industries** list (§4 Acceptable Use) appropriate and complete?

### Processor / DPA (tenant as controller)

8. Is the **DPA overview** sufficient for self-serve SMB tenants, or do we need a full executed DPA template?
9. Are **subprocessor change-notification** commitments (Privacy §11, DPA §3) framed correctly (timing, objection rights)?
10. Does listing **AI-assisted development and support** subprocessors meet GDPR/PIPEDA flow-down expectations?

### Patron (end-user) notices

11. Is the **End-User Privacy Notice** adequate for kiosk/booking/track flows, given tenants are controllers?
12. Should patron notices explicitly name subprocessors (Twilio, etc.) or is controller + processor model enough?
13. Is patron SMS consent language (patron Terms §2) aligned with CASL/TCPA transactional messaging?

### AI and support operations

14. Does our disclosure match **actual practice** in `SUPPORT_OPERATIONS.md` (including optional `.env` and row-level data in AI tools)?
15. Any required **DPIA / PIA** for AI subprocessors or cross-border LLM inference?
16. Should we require **Cursor Enterprise DPA** or equivalent before processing tenant Customer Data through AI tools?

### CRM (future)

17. When we adopt a CRM, is the **“internal analysis only, not for sale”** subprocessor category sufficient?
18. What contractual terms must we have with the CRM vendor?

### Operational gaps (policy vs product)

19. Subprocessor change notification is **policy-only** today — is email/in-app notice before go-live legally sufficient without automated objection workflow?
20. **Re-acceptance** of Terms/Privacy on material updates is not automated — when is that required?

## Deliverables requested from counsel

- [ ] Redline or written approval of each published artifact (or list of required edits)
- [ ] Confirmation of legal entity name, governing law, and contact email
- [ ] Full **DPA template** recommendation (if overview is insufficient for target customers)
- [ ] **Tenant-facing sample language** for patrons (optional appendix tenants can paste)
- [ ] Sign-off that AI/subprocessor disclosures match described ops, or list of required doc/ops changes
- [ ] Brief memo on US + Canada (PIPEDA/CASL) gaps for SMS consent implementation vs legal text

## How to review efficiently

1. Read this brief and `SUPPORT_OPERATIONS.md`.
2. Review source files under `apps/web/src/content/legal/` (single source for public pages).
3. Spot-check live pages after deploy: `/terms`, `/privacy`, `/patron-privacy`, `/dpa`, `/subprocessors`.
4. Return edits as PR comments or a marked document; engineering will apply in `*.ts` content files and bump `packages/shared/src/constants/legal.ts` versions.

**Prepared:** 2026-06-04  
**Owner:** Platform engineering + legal
