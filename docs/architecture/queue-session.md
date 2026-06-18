# Queue session (live line)

Operational queues use a **branch-local calendar day** as the live session boundary. This keeps agent consoles, lobby displays, and public track pages aligned.

## Definition

| Term              | Meaning                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| **Live session**  | Tickets with `bookedAt >=` start of today in the branch IANA timezone (`America/Vancouver`, etc.) |
| **Prior session** | Tickets still marked `waiting` but booked before today's midnight — not in the live line          |

Shared helpers live in `packages/api/src/common/live-queue-session.ts`.

## Where it applies

| Surface                                  | Scope                                                |
| ---------------------------------------- | ---------------------------------------------------- |
| Single-step / multi-step workbench       | Active tickets for selected queue(s), `period=today` |
| Public track (`GET /tickets/:id` public) | Position and `waitingTotal` for non-journey tickets  |
| Lobby display board                      | Branch waiting count and “up next”                   |
| Staff actions (call next, etc.)          | Rejects tickets from prior sessions                  |

Journey visits (`visitId` set) skip band estimates on the ticket track page; use visit track instead.

## Hygiene

- **Nightly job** (03:30 server cron): cancels prior-session `waiting` tickets org-wide when `app.queue.closePriorSessionWaiting` is true (default).
- **Manual (owner/admin):** `POST /api/v1/tickets/ops/close-prior-session-waiting?dryRun=true&branchId=...`

Run `dryRun=true` first to see how many rows would be closed.

## Agent console API

`GET /api/v1/tickets/queue/:queueId/live-slice?period=today` returns live tickets plus queue stats in one response (used by single-step web).

## Redis

Public track waiting order is cached under `cache:q-waiting-ids:v2:{queueId}:{tzToken}` (60s TTL). Invalidated when queue stats are invalidated on ticket transitions.
