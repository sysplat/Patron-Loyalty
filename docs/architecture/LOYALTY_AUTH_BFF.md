# Loyalty app auth BFF (Phase 4)

Patron Loyalty staff auth uses a **Next.js BFF** on `apps/loyalty` — browsers never persist JWTs in `localStorage`.

## Session carriers

| Layer            | Mechanism                                                               |
| ---------------- | ----------------------------------------------------------------------- |
| HttpOnly cookies | `WEB_SESSION_COOKIE` (access JWT), `WEB_REFRESH_COOKIE` (refresh token) |
| In-memory only   | `useAuthStore.accessToken` for `Authorization: Bearer` on API calls     |
| Persisted        | `user` profile only (`qp-auth-v2-user` via zustand `partialize`)        |

## Flows

### Login

1. `POST /api/auth/login` → upstream `pl-api` `/auth/login`
2. BFF sets HttpOnly cookies via `setAuthCookies`
3. Response JSON **strips** `data.tokens` (`stripTokensFromLoginPayload`)
4. Client calls `refreshAccessToken()` → `POST /api/auth/refresh` (cookie rotation)
5. Client calls `GET /api/auth/token` → reads session cookie server-side into memory (`syncAccessTokenFromBff`)
6. `setAuth(accessToken, user)` — token not written to `localStorage`

### Refresh (dashboard load, 401 retry, multi-tab)

1. `POST /api/auth/refresh` — refresh cookie sent automatically
2. BFF rotates cookies; JSON returns `{ success, data?: { platformOperator? } }` only
3. `GET /api/auth/token` syncs in-memory access JWT

### Session probe

- `GET /api/auth/session` → `{ authenticated: true \| false }` — **no JWT in body**

### Logout

- `POST /api/auth/logout` clears cookies; client clears zustand state

## Impersonation (platform operators)

- Short-lived impersonation JWT applied via `beginImpersonation` (in-memory)
- Prior session backed up in module scope (`impersonationBackup`), not `localStorage`
- `impersonation-handoff-bootstrap.tsx` handles admin → tenant handoff query params

## Security headers

Shared `securityHeaders()` from `scripts/next-security-headers.cjs` applied in `next.config.js` for all routes.

## Verification

```bash
pnpm --filter @queueplatform/loyalty test    # auth-store static guards
pnpm --filter @queueplatform/e2e test -- tests/loyalty-login-a11y.spec.ts
```

Prod smoke: `pnpm audit:loyalty-auth-smoke` with `LOYALTY_SMOKE_EMAIL` / `LOYALTY_SMOKE_PASSWORD`.
