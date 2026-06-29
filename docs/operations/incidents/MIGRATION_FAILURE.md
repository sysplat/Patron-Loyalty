# Database migration failure (Patron Loyalty)

**Symptoms:** pl-api crash loop; deploy logs show Prisma migrate error; `pnpm db:migrate:status:railway` fails.

## Triage (5 min)

1. Railway → pl-api deploy logs — find failed migration name.
2. `pnpm db:migrate:status:railway` (requires `railway link` + DB access).
3. Confirm no manual DDL on production outside Prisma migrations.

## Safe actions

| Situation                          | Action                                                            |
| ---------------------------------- | ----------------------------------------------------------------- |
| Migration pending, API won't start | `railway run` → `pnpm db:migrate:deploy` from `packages/database` |
| Failed mid-migration               | Do **not** re-run blindly; inspect `_prisma_migrations` table     |
| Drift (DB ≠ schema)                | `prisma migrate diff` in staging clone first                      |

## Rollback

- Prefer **forward-fix** migration over revert.
- If deploy must roll back: redeploy previous Railway image **only if** DB migrations are backward-compatible.

## Recovery verification

```bash
pnpm db:migrate:status:railway
curl -sS "$API/api/v1/health"   # 200
```
