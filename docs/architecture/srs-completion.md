# SRS completion map

Source document: [`Complete_Loyalty_Management_System_SRS.pdf`](../Complete_Loyalty_Management_System_SRS.pdf)

This tracks implementation in **Patron Loyalty** (`sysplatLMS`) against the SRS modules and MVP roadmap (§28).

**Overall:** ~**72%** of the full SRS · ~**92%** of MVP + Phase 2 (web/SaaS scope, excluding native mobile)

| Phase (SRS §28)                                          | Status      | Notes                                                                                   |
| -------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------- |
| Phase 1 — Customer, Points, Rewards, Coupons, Dashboard  | **Done**    | Staff app + API + Prisma domain                                                         |
| Phase 2 — Wallet, Referral, Marketing automation, Mobile | **Partial** | Wallet/referral/campaigns done; native mobile deferred (responsive portal/card instead) |
| Phase 3 — Gamification, AI, Coalition, Marketplace       | **Partial** | Badges/challenges/stamp card/leaderboard; ML/coalition/marketplace deferred             |

## Module-by-module

| §   | Module                           | Status       | Implementation                                                                                     |
| --- | -------------------------------- | ------------ | -------------------------------------------------------------------------------------------------- |
| 4   | Architecture (multi-tenant SaaS) | **Done**     | `Organization.productSku`, RLS, Railway deploy                                                     |
| 5   | Customer management              | **Done**     | `Customer`, patron directory, profile, tags/notes, timeline, consent ledger                        |
| 6   | Loyalty engine                   | **Done**     | Earn/burn/expiry, earn rules, tier upgrade, manual adjust, integration earn                        |
| 7   | Membership tiers                 | **Done**     | 5 default tiers, benefits JSON, tier-gated coupons                                                 |
| 8   | Rewards catalog                  | **Done**     | CRUD, stock, validity, staff + patron redemption                                                   |
| 9   | Referral system                  | **Done**     | Codes, invite link, QR, public `/refer/[code]` join, stats + report                                |
| 10  | Wallet                           | **Done**     | Credit/debit/refund/cashback/bonus/gift + transaction history                                      |
| 11  | Coupon & promotion               | **Done**     | Percent/fixed/BOGO, tier limits; branch/product limits via integration                             |
| 12  | Gift cards                       | **Done**     | Issue, balance, expiry; transfer via wallet adjust                                                 |
| 13  | Gamification                     | **Partial**  | Badges, challenges, digital stamp card, leaderboard — no spin wheel / scratch card                 |
| 14  | CRM                              | **Partial**  | Timeline, notes, tasks — no support tickets / sales opportunities                                  |
| 15  | Marketing automation             | **Partial**  | SMS, email, in-app; triggered welcome/birthday/win-back/tier/abandoned — no WhatsApp/push delivery |
| 16  | Segmentation                     | **Partial**  | Built-in + saved segments; RFM-style loyalty presets added                                         |
| 17  | Analytics & BI                   | **Partial**  | Executive dashboard + points/campaign/churn/growth/referral/VIP reports — not full BI suite        |
| 18  | Mobile app                       | **Deferred** | Responsive patron portal + digital card (PWA-ready)                                                |
| 19  | POS / e-commerce integrations    | **Partial**  | Integration API v1 + QlessQ connector; no Shopify/WooCommerce plugins                              |
| 20  | Multi-branch / franchise         | **Partial**  | Branch-scoped patron list when QMS linked; no franchise rollup reports                             |
| 21  | Security & compliance            | **Partial**  | RBAC, MFA (staff auth), audit/consent ledger, TLS; SSO/GDPR DSAR tooling planned                   |
| 22  | User roles                       | **Partial**  | QMS RBAC reused; no dedicated Cashier/Support LMS roles                                            |
| 23  | SaaS requirements                | **Done**     | Multi-tenant, Stripe plans, loyalty activation/trial                                               |
| 24  | AI features                      | **Partial**  | Rule-based health score + churn risk; no ML models                                                 |
| 25  | Advanced competitive             | **Partial**  | QlessQ queue integration; NFC/coalition/marketplace/geofencing deferred                            |
| 26  | Reporting                        | **Partial**  | Core reports in staff app; CSV export not yet                                                      |
| 27  | Database entities                | **Done**     | Prisma models for all core LMS entities                                                            |
| 29  | Non-functional                   | **Partial**  | API-first, responsive UI; multi-language/currency not implemented                                  |

## Key surfaces

| Surface       | Path                                                                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Staff LMS     | `apps/loyalty` — `/overview`, `/patrons`, `/rewards`, `/coupons`, `/wallet`, `/referrals`, `/campaigns`, `/engagement`, `/reports`, `/program`, `/integrations`, `/tasks` |
| Patron portal | `/portal/[code]`, `/card/[code]`, `/refer/[code]`                                                                                                                         |
| API           | `/api/v1/loyalty/*`, `/api/v1/customers/*`, `/api/v1/loyalty/integrations/v1/*`                                                                                           |

## Deferred (explicit “Later” in `patron-loyalty.md`)

- Native iOS/Android apps
- Coalition / marketplace rewards
- ML-based AI (§24)
- Spin wheel, scratch cards
- WhatsApp / push campaign delivery
- Shopify / WooCommerce / Square native connectors
- Platform admin in this repo (`apps/admin` lives in QMS)

## Related docs

- [patron-loyalty.md](./patron-loyalty.md) — product architecture
- [PATRON_LOYALTY_LAUNCH_CHECKLIST.md](../compliance/PATRON_LOYALTY_LAUNCH_CHECKLIST.md) — pre-production gates
