# ADR 002: Loyalty staff auth — HttpOnly cookie BFF

**Status:** Accepted  
**Date:** 2026-06-29

## Context

Staff UI (`apps/loyalty`) must not persist JWTs in `localStorage`. Browser clients still need an in-memory access token for direct `Authorization` headers to `pl-api`.

## Decision

1. **BFF routes** on Next.js (`/api/auth/login`, `/api/auth/refresh`) set `WEB_SESSION_COOKIE` + `WEB_REFRESH_COOKIE` (HttpOnly, SameSite=Lax).
2. **Login and refresh JSON** strip token material; clients call `GET /api/auth/token` for same-origin in-memory sync only.
3. **Zustand persist** stores `user` profile only (`partialize` — no `accessToken`).
4. **Session probe** `GET /api/auth/session` returns `{ authenticated }` only.
5. Impersonation uses short-lived in-memory JWT with session backup in module scope (not `localStorage`).

## Consequences

- **Positive:** XSS cannot exfiltrate refresh tokens from storage; aligns with enterprise auth bar.
- **Negative:** Extra BFF hop for token sync; multi-tab refresh requires lock coordination.
- **Verify:** `pnpm --filter @queueplatform/loyalty test`; [LOYALTY_AUTH_BFF.md](../LOYALTY_AUTH_BFF.md)

## References

- [LOYALTY_AUTH_BFF.md](../LOYALTY_AUTH_BFF.md)
- [incidents/LOYALTY_AUTH_OUTAGE.md](../../operations/incidents/LOYALTY_AUTH_OUTAGE.md)
