# Patron Loyalty — pre-launch checklist (internal)

Use after engineering deploy; **do not treat as counsel-approved** until `COUNSEL_REVIEW_BRIEF_LOYALTY.md` is signed off.

## 1. Counsel (required before marketing)

- [ ] Send `docs/compliance/COUNSEL_REVIEW_BRIEF_LOYALTY.md` to qualified counsel
- [ ] Apply redlines in `apps/loyalty/src/content/legal/*.ts`
- [ ] Bump `CURRENT_LOYALTY_*` versions in `packages/shared/src/constants/legal.ts`
- [ ] Run `node scripts/compliance/check-legal-placeholders.mjs`
- [ ] Spot-check production URLs: `/terms`, `/privacy`, `/patron-terms`, `/patron-privacy`, `/dpa`, `/subprocessors`

## 2. Patron-Loyalty Railway (`Patron-Loyalty` project)

| Service            | Check                                           |
| ------------------ | ----------------------------------------------- |
| `pl-loyalty`       | Deployed from latest `main`; public URL works   |
| `pl-api`           | `GET /api/v1/health` OK; `APP_DATABASE_URL` set |
| `pl-notifications` | Running when SMS/email campaigns used           |
| `pl-centrifugo`    | CORS includes loyalty origin                    |

**Build-time on `pl-loyalty`:**

```bash
NEXT_PUBLIC_API_URL=https://<pl-api-host>/api/v1
NEXT_PUBLIC_CENTRIFUGO_WS_URL=wss://<centrifugo-host>/connection/websocket
```

## 3. QlessQ Railway (queue product — link out to LMS)

Set on **web** and **admin** (rebuild required for `NEXT_PUBLIC_*`):

```bash
NEXT_PUBLIC_LOYALTY_URL=https://pl-loyalty-production.up.railway.app
```

Set on **qms-api**:

```bash
LOYALTY_URL=https://pl-loyalty-production.up.railway.app
```

Add loyalty host to **qms-api** `APP_ALLOWED_ORIGINS`.

Disable legacy **qms-loyalty** service if still deployed from QlessQ repo.

## 4. Bundle / split-deploy tenants

- [ ] LMS: rotate Integration API key (`/integrations` in loyalty app)
- [ ] QMS: `POST /api/v1/loyalty/connector` with `apiBaseUrl` + `apiKey`
- [ ] Smoke: complete a ticket → points ledger entry in LMS

## 5. Prohibited businesses

Patron Loyalty uses the **same prohibited-industry list** as QlessQ (`packages/shared/src/constants/prohibited-businesses.ts`). Do not onboard tenants in those categories for either product.

## 6. Patron portal consent

- [ ] `POST /loyalty/public/portal/:code/consent` returns 200 and writes `consent_ledger_entries`
- [ ] Redeem/profile blocked until consent recorded
- [ ] Staff can export consent history via customer timeline / consent ledger APIs

## 7. Vendor alignment

- [ ] `loyalty-subprocessors.ts` matches production vendors (Railway, Twilio, Stripe, Postgres, Redis, Centrifugo, Sentry if enabled)
- [ ] Sync `docs/compliance/SUBPROCESSORS.md` after any vendor change

**Last updated:** 2026-06-17
