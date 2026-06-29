# Railway — enable Sentry on pl-api (Phase 5)

**Status:** Manual step — CLI requires `railway login` and `SENTRY_DSN` in `.env` or Railway UI.

## Railway UI (recommended)

1. Open [Railway](https://railway.app) → **Patron Loyalty** project → service **`pl-api`**
2. **Variables** → add:

| Variable         | Value                                            |
| ---------------- | ------------------------------------------------ |
| `SENTRY_DSN`     | Your Sentry project DSN (Settings → Client Keys) |
| `SENTRY_RELEASE` | `${{RAILWAY_GIT_COMMIT_SHA}}`                    |

3. **Redeploy** `pl-api`
4. Optional on **`pl-loyalty`**: `NEXT_PUBLIC_SENTRY_DSN` (client errors)

## Verify

```bash
pnpm audit:verify-sentry-prod
# expect: "sentryEnabled": true
```

## CLI (when authenticated)

```bash
railway login
# Add SENTRY_DSN to repo root .env, then:
./scripts/railway-sync-sentry-env.sh
# Redeploy pl-api + pl-loyalty in Railway UI
```

## After enable

- Update scorecard in `PATRON_LOYALTY_10X_ROADMAP.md` to **8.9** (Operability)
- Mark Phase 5 Sentry item complete in launch checklist
