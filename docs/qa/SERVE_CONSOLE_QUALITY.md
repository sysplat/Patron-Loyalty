# Serve console quality bar

Target scores for **single-step** (`/dashboard/single-step`) and **multi-step** (`/dashboard/multi-step`) staff serve UIs.

Legacy URLs redirect: `/dashboard/agent` → single-step, `/dashboard/journey` and `/dashboard/workbench` → multi-step.

## Live data contract (`apps/web/src/lib/serve/live/`)

Shared module for Centrifugo + React Query behavior on both surfaces.

### Single-step source-of-truth (priority, highest wins)

1. **React Query `live-slice`** — `GET /tickets/queue/:id/live-slice` (`singleStepQueueTicketsQueryKey`)
2. **Realtime** — patch **active ticket (“now serving”) only**; debounced `invalidateSingleStepLiveSlice` for waiting list + stats
3. **Optimistic mutations** — `syncSingleStepLiveSlice(patch)` then invalidate; never hand-edit waiting list outside live-slice helpers
4. **Polling** — `SINGLE_STEP_LIVE_SLICE_POLL_MS` (5s) only when Centrifugo disconnected (`intervalWhenDisconnected`)

Active desk reconciliation: `active-ticket-sync.ts` + `SINGLE_STEP_ACTIVE_TICKET_GRACE_MS` (5s) after call-next.

### Multi-step source-of-truth

1. **React Query workbench** — `GET /workbench?forJourney=true`
2. **Realtime** — `handleJourneyQueueRealtimePublication` (cache patch + debounced refetch delays in `constants.ts`)
3. **Optimistic complete** — advancing preview **after** successful `POST /workbench/actions/complete` only
4. **Polling** — `JOURNEY_WORKBENCH_POLL_MS` when realtime disconnected

## Automated checks

```bash
# Unit + integration-style specs (includes React Query hook tests + serve/live)
pnpm --filter @queueplatform/web test -- src/lib/single-step src/lib/journey src/lib/serve/live src/lib/api-response src/lib/serve/use-journey-workbench.spec.tsx src/lib/single-step/use-single-step-queue-queries.spec.tsx

# E2E (web :3001, API :4000, seeded DB)
pnpm --filter @queueplatform/e2e test -- tests/serve-console.spec.ts
```

## PR checklist (serve UI changes)

- [ ] Waiting list / lane counts come from live-slice or workbench query — not ad-hoc `useState` ticket arrays
- [ ] Realtime handler uses `@/lib/serve/live` (or calls `syncSingleStepLiveSlice` / `handleJourneyQueueRealtimePublication`)
- [ ] Polling uses `intervalWhenDisconnected` with constants from `serve/live/constants.ts`
- [ ] Ran web serve test glob above (or CI equivalent)
- [ ] Manual: disconnect realtime → polling resumes; reconnect → polling stops

## Phase history

### Phase 1–4 (shipped)

See git history: active-ticket reconciliation, contexts, E2E, hook tests, `ServeLiveAnnounceProvider`, journey extractions.

### Phase 5 — Serve-live layer (shipped)

- **`lib/serve/live/`** — terminal event map, debounced invalidation hook, single-step invalidate helpers, journey realtime handler
- **Single-step mutations** — unified `syncSingleStepLiveSlice` / `invalidateSingleStepLiveSlice`
- **Journey stack** — modularized under `components/serve/journey/` (~500-line orchestrator)

## Remaining (nice-to-have)

- Sticky call bar focus trap audit
- Full reduced-motion design review

## Manual QA

`docs/qa/SERVE_CONSOLE_MANUAL_QA.md` — include Centrifugo disconnect/reconnect row for serve consoles.
