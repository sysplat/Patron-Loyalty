# Counsel Data Map — QPlatform ↔ Patron Loyalty

**One-page handout for counsel.** Not legal advice. Companion to `COUNSEL_REVIEW_BRIEF.md` and `/loyalty-integration`.

**Prepared:** 2026-08-27 · **Contact:** support@sysplat.com

---

## Parties and roles

| Party                         | Role                                                                                                                                |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Tenant organization           | Data **controller** (business) for patrons                                                                                          |
| Sysplat QPlatform             | Data **processor** / service provider (queue, appointments, SMS)                                                                    |
| Sysplat Patron Loyalty        | **Affiliated product**, same platform provider = also **processor** when licensed/linked — **not** an independent third-party buyer |
| Twilio, Stripe, hosting, etc. | Third-party **subprocessors** (`/subprocessors`)                                                                                    |

Public product names today: **Sysplat QPlatform** / **Sysplat Patron Loyalty**. Counsel to confirm registered corporate entity name and governing-law venue.

---

## Systems and what each stores

```text
┌──────────────────────────────┐         optional link          ┌──────────────────────────────┐
│  Sysplat QPlatform (QMS)     │  ──── events + backfill ────►  │  Sysplat Patron Loyalty      │
│  Tickets, visits, appts      │         (one-way)              │  Points, tiers, rewards      │
│  Reviews, queues, branches   │                                │  Campaigns, referrals        │
│  Customer stub (name/phone/  │                                │  Optional profile (DOB, etc.)│
│  email, SMS/mktg flags)      │                                │  Consent ledger (portal)     │
└──────────────────────────────┘                                └──────────────────────────────┘
```

| Domain    | Primary store | Typical PII / records                                                                            |
| --------- | ------------- | ------------------------------------------------------------------------------------------------ |
| Queue ops | QPlatform DB  | Name, phone, email, ticket/visit/appointment status, reviews, SMS consent flags                  |
| Loyalty   | LMS DB        | Contact + matching IDs, points/tiers/rewards, campaigns, optional profile fields, portal consent |

---

## Transfer trigger and payload

| Item                       | Detail                                                                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Trigger                    | Owner/admin links connector (Settings → Integrations) + checkbox acknowledgment                                              |
| Audit                      | `consent.loyalty.data_transfer_accepted` (terms/privacy/addendum versions, IP, UA)                                           |
| Direction                  | **QPlatform → Patron Loyalty only**                                                                                          |
| Events                     | `customer.created`, `ticket.completed`, `ticket.no_show`, `appointment.completed`, `appointment.no_show`, `review.submitted` |
| Fields                     | Name, email, phone, customer/branch/service IDs, outcomes, review content/rating, event metadata                             |
| First connect              | **Historical backfill** of eligible past events                                                                              |
| Not transferred by default | Marketing / SMS consent history                                                                                              |

---

## Disconnect, retention, DSAR

| Action         | Effect                                                                         |
| -------------- | ------------------------------------------------------------------------------ |
| Disconnect     | Stops **new** transfers; does **not** auto-erase LMS data                      |
| Retention      | Each product keeps its own retention defaults + tenant instructions            |
| Patron request | Tenant responds; apply in **both** products when both hold records             |
| Cascade delete | **No** automatic cascade unless a documented cross-product workflow is enabled |

Ops detail: `CROSS_PRODUCT_PRIVACY_OPS.md`.

---

## Public artifacts to review

| Surface        | Paths                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| QPlatform      | `/terms` `/privacy` `/dpa` `/subprocessors` `/loyalty-integration` `/patron-privacy` `/patron-terms`   |
| Patron Loyalty | `/terms` `/privacy` `/dpa` `/subprocessors` `/qplatform-integration` `/patron-privacy` `/patron-terms` |

---

## Open counsel decisions (checklist)

- [ ] Registered legal entity name vs public brand
- [ ] Governing law / venue (Terms §13)
- [ ] Affirmed “affiliated product / same processor” framing
- [ ] Adequacy of Integration Addendum + self-serve DPA overview vs executed DPA + SCCs
- [ ] Quebec / French requirements
- [ ] Whether patron notices must name Twilio et al. explicitly
