# Counsel Review Brief — Patron Loyalty (LMS)

**Internal — for qualified legal counsel only.** This brief helps an attorney review Patron Loyalty published legal artifacts before public launch. It is not legal advice.

## Product summary

- **Product:** Patron Loyalty — multi-tenant B2B SaaS for patron CRM, loyalty points, tiers, rewards, campaigns, referrals, and related analytics.
- **Relationship to QlessQ:** Separately licensed product. May connect to QlessQ queue data when both are on the same org; loyalty-only tenants use imports, staff entry, or the Integration API.
- **Customers:** Organizations (tenants) — marketing teams, front desk, managers.
- **End users:** Patrons — loyalty portal (`/portal/[code]`), digital card (`/card/[code]`).
- **Roles:** Tenant = data controller (typical). QlessQ = data processor / service provider for Patron Data.
- **Markets:** US and Canada emphasized (CASL, PIPEDA references). Cross-border processing disclosed.
- **Data sale:** We **do not sell, rent, or trade** personal information.

## Prohibited businesses (must match QlessQ)

Patron Loyalty uses the **same prohibited-industry list** as QlessQ queue management (high-risk financial services, lead gen/affiliate, regulated drugs, SHAFT, gambling). Organizations in these categories may not use Patron Loyalty. Source: `packages/shared/src/constants/prohibited-businesses.ts` and Patron Loyalty Terms §5.

## Published legal artifacts (review these)

| Document                         | Public URL        | Source file                                                | Version    |
| -------------------------------- | ----------------- | ---------------------------------------------------------- | ---------- |
| Patron Loyalty Terms (tenant)    | `/terms`          | `apps/loyalty/src/content/legal/loyalty-terms.ts`          | 2026-06-17 |
| Patron Loyalty Privacy (tenant)  | `/privacy`        | `apps/loyalty/src/content/legal/loyalty-privacy.ts`        | 2026-06-17 |
| Loyalty Program Privacy (patron) | `/patron-privacy` | `apps/loyalty/src/content/legal/loyalty-patron-privacy.ts` | 2026-06-17 |
| Loyalty Program Terms (patron)   | `/patron-terms`   | `apps/loyalty/src/content/legal/loyalty-patron-terms.ts`   | 2026-06-17 |
| DPA overview                     | `/dpa`            | `apps/loyalty/src/content/legal/loyalty-dpa-overview.ts`   | 2026-06-17 |
| Subprocessor register            | `/subprocessors`  | `apps/loyalty/src/content/legal/loyalty-subprocessors.ts`  | 2026-06-17 |

**Companion internal docs:** `docs/compliance/COUNSEL_REVIEW_BRIEF.md` (QlessQ queue product), `SUPPORT_OPERATIONS.md`, `GLOBAL_COMPLIANCE_PROGRAM.md`.

**Legal contact:** `legal@queueplatform.com` (`packages/shared/src/constants/brand.ts`)

**Tenant registration audit:** Signup records `LegalAcceptance` with loyalty terms/privacy versions (`packages/api/src/modules/auth/auth-registration.service.ts`).

**Patron portal consent audit:** `POST /loyalty/public/portal/:code/consent` writes `ConsentLedgerEntry` (`channel: legal`, `purpose: patron_portal`) with IP, user-agent, and bundled legal version. Redeem/profile actions require server-side consent.

## Questions for counsel (LMS-specific)

1. Are Patron Loyalty tenant Terms and Privacy adequate for standalone CRM/loyalty SKU and bundle add-on?
2. Are **Loyalty Program** patron Terms/Privacy sufficient for optional profile fields (birthday, gender, city) and marketing campaigns?
3. Is the **prohibited industries** clause (aligned with QlessQ) appropriate for Patron Loyalty messaging use cases?
4. Is the **DPA overview** sufficient for self-serve SMB tenants, or is a full executed DPA required?
5. Does patron portal **server-side consent ledger** meet evidentiary expectations for CASL/PIPEDA marketing opt-in flows?
6. Should patron notices name subprocessors (Twilio, etc.) explicitly?
7. Any Quebec/French-language requirements for loyalty marketing to Canadian patrons?

## Deliverables requested from counsel

- [ ] Redline or written approval of each Patron Loyalty published artifact
- [ ] Confirmation that prohibited-business language matches QlessQ policy intent
- [ ] Sign-off on patron portal consent audit approach or required changes
- [ ] Full DPA template recommendation if overview is insufficient

## How to review efficiently

1. Read this brief and QlessQ `docs/compliance/SUPPORT_OPERATIONS.md` for shared subprocessors/AI ops.
2. Review source files under `apps/loyalty/src/content/legal/`.
3. Spot-check live pages: `/terms`, `/privacy`, `/patron-privacy`, `/patron-terms`, `/dpa`, `/subprocessors`.
4. Return edits as PR comments; engineering applies in `*.ts` content files and bumps `packages/shared/src/constants/legal.ts` versions.

**Prepared:** 2026-06-17  
**Owner:** Platform engineering + legal
