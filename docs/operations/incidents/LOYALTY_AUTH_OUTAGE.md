# Loyalty staff auth outage

**Symptoms:** Staff cannot sign in at `pl-loyalty`; `/api/auth/login` returns 5xx; dashboard redirects to login loop.

## Triage (5 min)

1. `curl -sS https://pl-api-production-a528.up.railway.app/api/v1/health` — if not 200, fix API/DB first.
2. `curl -sS https://pl-loyalty-production.up.railway.app/api/health` — loyalty BFF up?
3. `pnpm audit:loyalty-auth-smoke` with `LOYALTY_SMOKE_EMAIL` / `LOYALTY_SMOKE_PASSWORD`.

## Common causes

| Cause                                                                   | Fix                                                                                                     |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` rotated without redeploying loyalty | Redeploy **pl-loyalty** after API secret change                                                         |
| API down or wrong `API_URL` on loyalty service                          | Railway → pl-loyalty → `API_URL` points to pl-api                                                       |
| Cookie `Secure` mismatch (HTTP staging)                                 | Use HTTPS or set `NODE_ENV` / cookie env per [LOYALTY_AUTH_BFF.md](../architecture/LOYALTY_AUTH_BFF.md) |
| Refresh storm (multi-tab)                                               | User closes extra tabs; check Redis if refresh rate-limited                                             |

## Escalation

- Sentry (when enabled): filter `pl-loyalty` + `pl-api` auth routes.
- Logs: search `auth-bff` / `/auth/login` / `/auth/refresh` on pl-api.

## Recovery verification

```bash
LOYALTY_URL=https://pl-loyalty-production.up.railway.app \
LOYALTY_SMOKE_EMAIL=... LOYALTY_SMOKE_PASSWORD=... \
pnpm audit:loyalty-auth-smoke
```
