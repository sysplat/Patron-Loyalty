# Serve-surface migration runbook

Sign-off gate for classic (single-step) vs journey (multi-step) queue separation before enterprise release.

## Scope

- Tenant staff serve UIs: `/dashboard/single-step`, `/dashboard/multi-step`
- Database invariants: classic tickets on classic queues; journey tickets on journey queues
- Counter/desk profiles aligned with branch journey mode

## Automated audit

From repo root with a reachable `DATABASE_URL`:

```bash
pnpm --filter @queueplatform/database audit:serve-surface
```

Optional scoped audit:

```bash
pnpm --filter @queueplatform/database exec tsx scripts/audit-serve-surface-separation.ts --org=<orgId>
```

Repair counter capability profiles when audit reports mismatches (review diff first):

```bash
pnpm --filter @queueplatform/database audit:serve-surface:repair-profiles
```

**Pass criteria:** script exits 0 with no blocking rows printed (classic-on-journey / journey-on-classic / profile drift).

## Manual UI smoke (staging)

1. Sign in as org admin with both single-step and multi-step branches.
2. **Single-step:** open serve queue, call → serve → complete one walk-in; confirm realtime update without full-page refresh.
3. **Multi-step:** open journey serve, advance one visit across at least two steps; confirm queue stack + workbench stay in sync.
4. Switch branches via serve header; confirm localStorage keys are namespaced per org (`serve-surface-routing`).

## Sign-off checklist

| Step                                      | Owner | Date | Evidence               |
| ----------------------------------------- | ----- | ---- | ---------------------- |
| DB audit script exit 0 on staging         |       |      | paste command + output |
| Single-step smoke on staging              |       |      | ticket id / screenshot |
| Multi-step smoke on staging               |       |      | visit id / screenshot  |
| No P0/P1 serve regressions in Sentry (7d) |       |      | link                   |

When all rows are filled, check the matrix item in `docs/qa/ENTERPRISE_ACCEPTANCE_MATRIX.md`.

## Rollback

- UI: revert web deploy; serve routing falls back to last release behavior.
- Data: audit script is read-only unless `--repair-profiles` was run; keep backup before repair.
