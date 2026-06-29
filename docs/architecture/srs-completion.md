# SRS completion map

> **QMS sibling repo:** References to `apps/web` or `apps/admin` describe the **QlessQ** queue product in the sibling `../QMS` repository — not Patron Loyalty (`apps/loyalty`). See [REPO_BOUNDARIES.md](../architecture/REPO_BOUNDARIES.md).

Source document: [`Complete_Loyalty_Management_System_SRS.pdf`](../Complete_Loyalty_Management_System_SRS.pdf)

This tracks implementation in **Patron Loyalty** (`sysplatLMS`) against the SRS modules and MVP roadmap (§28).

**Overall:** ~**88%** of the full SRS · ~**97%** of MVP + Phase 2 (web/SaaS scope, excluding native mobile)

| Phase (SRS §28)                                          | Status          | Notes                                                                                                                                          |
| -------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 1 — Customer, Points, Rewards, Coupons, Dashboard  | **Done**        | Staff app + API + Prisma domain                                                                                                                |
| Phase 2 — Wallet, Referral, Marketing automation, Mobile | **Mostly done** | Wallet/referral/campaigns done; WHATSAPP/PUSH channels wired (SMS fallback / skipped); native mobile deferred (responsive portal/card instead) |
| Phase 3 — Gamification, AI, Coalition, Marketplace       | **Partial**     | Badges/challenges/stamp/leaderboard/spin/scratch; ML/coalition/marketplace deferred                                                            |

## Module-by-module

| §   | Module                           | Status          | Implementation                                                                                |
| --- | -------------------------------- | --------------- | --------------------------------------------------------------------------------------------- |
| 4   | Architecture (multi-tenant SaaS) | **Done**        | `Organization.productSku`, RLS, Railway deploy                                                |
| 5   | Customer management              | **Done**        | `Customer`, patron directory, profile, tags/notes, timeline, consent ledger                   |
| 6   | Loyalty engine                   | **Done**        | Earn/burn/expiry, earn rules with conditions, tier upgrade, manual adjust, integration earn   |
| 7   | Membership tiers                 | **Done**        | 5 default tiers, benefits JSON, tier-gated coupons                                            |
| 8   | Rewards catalog                  | **Done**        | CRUD, stock, validity, staff + patron redemption                                              |
| 9   | Referral system                  | **Done**        | Codes, invite link, QR, public `/refer/[code]` join, stats + report                           |
| 10  | Wallet                           | **Done**        | Credit/debit/refund/cashback/bonus/gift + transaction history; shown on patron portal         |
| 11  | Coupon & promotion               | **Done**        | Percent/fixed/BOGO, tier limits; branch/product limits via integration                        |
| 12  | Gift cards                       | **Done**        | Issue, balance, expiry; transfer via wallet adjust                                            |
| 13  | Gamification                     | **Mostly done** | Badges, challenges, stamp card, leaderboard, spin wheel + scratch card (patron portal)        |
| 14  | CRM                              | **Mostly done** | Timeline, notes, tasks, support tickets, sales opportunities (CRM hub UI)                     |
| 15  | Marketing automation             | **Mostly done** | SMS, email, in-app, WHATSAPP/PUSH channels; triggered campaigns; push provider not configured |
| 16  | Segmentation                     | **Done**        | All built-in presets (QMS + loyalty RFM) + saved segments in patrons + campaigns              |
| 17  | Analytics & BI                   | **Partial**     | Executive/sales/customer/campaign dashboard views + extended reports — not full BI suite      |
| 18  | Mobile app                       | **Deferred**    | Responsive patron portal + digital card (PWA-ready)                                           |
| 19  | POS / e-commerce integrations    | **Partial**     | Integration API v1 + QlessQ connector; no Shopify/WooCommerce plugins                         |
| 20  | Multi-branch / franchise         | **Partial**     | Branch-scoped patrons, branch performance report, public store locator — no franchise rollup  |
| 21  | Security & compliance            | **Mostly done** | RBAC, MFA (staff auth), audit/consent ledger, DSAR JSON export per patron — SSO deferred      |
| 22  | User roles                       | **Partial**     | QMS RBAC reused; no dedicated Cashier/Support LMS roles                                       |
| 23  | SaaS requirements                | **Done**        | Multi-tenant, Stripe plans, loyalty activation/trial                                          |
| 24  | AI features                      | **Partial**     | Rule-based health score + churn risk; no ML models                                            |
| 25  | Advanced competitive             | **Partial**     | QlessQ queue integration; NFC/coalition/marketplace/geofencing deferred                       |
| 26  | Reporting                        | **Mostly done** | Core reports + branch/ROI/sales + CSV export for points/referrals                             |
| 27  | Database entities                | **Done**        | Prisma models including CRM tickets, opportunities, patron game plays, locale/currency        |
| 29  | Non-functional                   | **Partial**     | API-first, responsive UI; display currency + default locale on program (full i18n deferred)   |

## Key surfaces

| Surface       | Path                                                                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Staff LMS     | `apps/loyalty` — `/overview`, `/patrons`, `/rewards`, `/coupons`, `/wallet`, `/referrals`, `/campaigns`, `/engagement`, `/reports`, `/program`, `/integrations`, `/tasks` |
| Patron portal | `/portal/[code]`, `/card/[code]`, `/refer/[code]` — wallet, games, store locator, next-best-offer                                                                         |
| API           | `/api/v1/loyalty/*`, `/api/v1/customers/*`, `/api/v1/loyalty/integrations/v1/*`, `/api/v1/loyalty/crm/*`                                                                  |

## Deferred (explicit “Later” in `patron-loyalty.md`)

- Native iOS/Android apps
- Coalition / marketplace rewards
- ML-based AI (§24)
- Real WhatsApp Business / mobile push providers
- Shopify / WooCommerce / Square native connectors
- SSO / dedicated LMS staff roles
- Platform admin in this repo (`apps/admin` lives in QMS)

## Related docs

- [patron-loyalty.md](./patron-loyalty.md) — product architecture
- [PATRON_LOYALTY_LAUNCH_CHECKLIST.md](../compliance/PATRON_LOYALTY_LAUNCH_CHECKLIST.md) — pre-production gates
