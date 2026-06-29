# ADR 004: `API_DEPLOY_PROFILE` module registry

**Status:** Accepted  
**Date:** 2026-06-29

## Context

`packages/api` contains both LMS and legacy QMS modules. Patron Loyalty production (`pl-api`) must not expose ticket/queue routes or load unnecessary QMS controllers.

## Decision

1. Env `API_DEPLOY_PROFILE=loyalty` on `pl-api` omits QMS modules at Nest boot (tickets, queues, workbench, etc.).
2. `API_DEPLOY_PROFILE=full` (default) loads all modules for bundle / QMS deploys.
3. Boundary smoke: health **200**, `/tickets` and `/queues` **404** on loyalty profile.
4. `QueueProductGuard` returns **404** for QMS prefixes when org `productSku` is `loyalty` even on full profile.

## Consequences

- **Positive:** Smaller attack surface on LMS-only deploy; clear split-deploy story with QlessQ sibling.
- **Negative:** Single codebase must maintain conditional module registry; integration tests cover both profiles where needed.
- **Verify:** `pnpm audit:staging-soak`; [REPO_BOUNDARIES.md](../REPO_BOUNDARIES.md)

## References

- [REPO_BOUNDARIES.md](../REPO_BOUNDARIES.md)
- `scripts/staging-soak-patron-loyalty.mjs`
