# Serve console manual QA checklist

Use this before calling single-step or multi-step consoles **10/10** in production. Automated coverage lives in `docs/qa/SERVE_CONSOLE_QUALITY.md`.

**Prerequisites:** local stack (`pnpm start` or `pnpm dev:full:local`), notifications worker if testing SMS, seeded or demo branch with at least one single-queue line and one 2+ step journey flow.

| Surface     | URL                      |
| ----------- | ------------------------ |
| Single-step | `/dashboard/single-step` |
| Multi-step  | `/dashboard/multi-step`  |

Record: browser, date, tester, branch name, desk number.

---

## Single-step — functional

- [ ] Sign in as staff assigned to an open desk; desk chip shows **Desk N** and queue picker lists expected line.
- [ ] Waiting panel shows correct tickets; **Call next** disabled when no waiting (or policy blocks).
- [ ] **Call next** → Now Serving shows ticket number; live region announces (screen reader or DOM `aria-live`).
- [ ] **Complete** clears Now Serving; ticket leaves active state; waiting counts update within ~5s (or immediately on realtime).
- [ ] Period toggle **Today / Week** refreshes stats and ticket list without stale ghost “Now Serving”.
- [ ] Desk filter: with filter on, ready/waiting counts reflect **this desk** only.

## Multi-step — functional

- [ ] Branch with active flow loads **Customer journey** step strip (2+ steps).
- [ ] **Start at desk** (or auto sign-in) establishes session; sticky **Call next** appears when policy allows.
- [ ] **Call next** on assigned step → current customer card; **Start serving** → **Complete step** advances visit.
- [ ] After complete on step 1, customer appears waiting on step 2 (select step in strip) — **not stuck on Incoming** for >20s.
- [ ] After complete on step 2 (final step), visit clears; no **Queue not found** or version-mismatch toast.
- [ ] View-only step (wrong desk) shows banner; no call/serve actions on that step.
- [ ] Pickup / `ready_then_fifo` step: **Mark ready** required before call next (if configured).

## Multi-tab

Open the **same** console URL in **Tab A** and **Tab B** (same user, same branch, same desk).

- [ ] Tab A: call next — Tab B shows same active customer within polling/realtime window (≤5s without RT, faster with Centrifugo).
- [ ] Tab B: complete ticket — Tab A clears Now Serving / current customer without full page reload.
- [ ] Tab A: change desk — Tab B unchanged (session is per-tab until refresh); after refresh, each tab respects persisted desk.
- [ ] No duplicate call-next for same ticket from both tabs without error toast (second action fails gracefully).

## Offline / connectivity

Use DevTools → **Network** → **Offline** (or throttle to Offline).

- [ ] Console shows disconnected/reconnecting state (if surfaced) or continues showing last snapshot without blank crash.
- [ ] **Call next** while offline → error toast; no phantom Now Serving after failed request.
- [ ] Go back **Online** → lists reconcile; no duplicate active tickets after refetch.
- [ ] Complete while offline → error; after online, state matches server (refresh if unsure).

## Accessibility (quick pass)

- [ ] Tab order: desk → queue/step → primary actions (Call next, Complete) without traps in sticky bar.
- [ ] Focus visible on **Call next** and **Complete** / **Complete step**.
- [ ] `prefers-reduced-motion`: no essential information conveyed by motion only (timers still readable).

## Regression smoke (automated backup)

```bash
pnpm --filter @queueplatform/web test -- src/lib/single-step src/lib/journey src/lib/serve/live src/lib/serve/use-journey-workbench.spec.tsx src/lib/single-step/use-single-step-queue-queries.spec.tsx
pnpm --filter @queueplatform/e2e test -- tests/serve-console.spec.ts
```

The E2E multi-step case covers: step 1 call → serve → complete → step 2 confirmed waiting (no stuck Incoming) → step 2 call → serve → complete, with guards for **Queue not found** / version-mismatch toasts.

---

## Sign-off

| Check                  | Pass | Notes |
| ---------------------- | ---- | ----- |
| Single-step functional |      |       |
| Multi-step functional  |      |       |
| Multi-tab              |      |       |
| Offline                |      |       |
| A11y quick pass        |      |       |

**Approved for production serve consoles:** ☐ Yes ☐ No — blocker:
