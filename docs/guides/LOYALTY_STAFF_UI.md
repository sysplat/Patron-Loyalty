# Patron Loyalty staff UI system

Authoritative layout and component rules for **every** authenticated staff page under `apps/loyalty/src/app/(dashboard)/`.

Cursor rule: [`.cursor/rules/loyalty-staff-ui.mdc`](../../.cursor/rules/loyalty-staff-ui.mdc).  
Primitives: `apps/loyalty/src/components/dashboard/`.

This is separate from the QMS-oriented [FRONTEND_GUIDE.md](./FRONTEND_GUIDE.md).

---

## Goals

- One professional language across Counter, Grow, Insights, and Setup.
- Shared shells, headers, guides, KPIs, empty/loading/permission states, and confirms.
- No page-local copies of EmptyState, ConfirmDialog, or ad-hoc page padding.

---

## Page anatomy

Default composition (top → bottom):

```text
PageShell                    space-y-5 pb-10  (± narrow for Counter)
  PageHeader                 title + subtitle + size="sm" actions
  GuideCard                  optional, collapsible
  StatStrip                  optional KPIs
  Primary work surface       list / form / table / charts
  States                     Skeleton · EmptyState · PermissionGate
```

Use primitives from `@/components/dashboard`:

| Primitive        | When                                |
| ---------------- | ----------------------------------- |
| `PageShell`      | Every page wrapper                  |
| `PageHeader`     | Title + one-line subtitle + actions |
| `GuideCard`      | Workflow teaching (Grow + Setup)    |
| `StatStrip`      | Compact summary metrics             |
| `FilterTabs`     | Muted pill filters                  |
| `EmptyState`     | No data / nothing to show           |
| `ConfirmDialog`  | Destructive or irreversible actions |
| `PermissionGate` | Role-denied content                 |

---

## Variants

| Variant          | Routes (examples)                                                                                                                  | Rules                                                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Ops (narrow)** | `/lookup`                                                                                                                          | `PageShell narrow` → `max-w-2xl mx-auto`. Skip Guide/KPIs unless they help the counter loop. Reuse EmptyState / banners. |
| **Workflow**     | Campaigns, Engagement, Coupons, Wallet, Tasks, Referrals, Rewards, Team, Billing, Business, Getting started, Program, Integrations | Full recipe: shell + header + optional Guide + optional StatStrip + body.                                                |
| **Analytics**    | `/overview`, `/reports`                                                                                                            | Shared header/shell/Empty/Skeleton. Charts stay; do not force Guide or StatStrip if the page already has chart cards.    |
| **Settings**     | Diagnostics, Business, Billing, Team, Program                                                                                      | Same as workflow; permission gates when owner/admin-only.                                                                |

Counter and Overview are **variants of this system**, not exceptions that invent new patterns.

---

## Typography & spacing

- Page title: `DASHBOARD_PAGE_HEADING_CLASS` from `@queueplatform/frontend-core` (via `PageHeader`).
- Subtitle: `text-muted-foreground mt-1 text-sm` — one sentence.
- Section titles inside cards: `CardTitle className="text-base"` (not oversized).
- Page shell: `space-y-5 pb-10`. Never nest another full-page pad inside the dashboard layout.
- Primary actions: `Button size="sm"`. Outline for secondary (Guide, Refresh).

---

## Guide card

- Use when the page teaches a multi-step workflow (campaigns, team roles, billing, getting started, program).
- Skip on pure ops Counter and dense analytics unless a short checklist helps.
- Toggle from header with BookOpen + Chevron; keep copy short (2–4 items).

---

## KPI strip

- Uppercase muted label + `text-2xl font-semibold tabular-nums`.
- Grid: `sm:grid-cols-2` / `lg:grid-cols-3|4`.
- Prefer `StatStrip` over hand-rolled card grids.

---

## States

| State                  | Pattern                                                    |
| ---------------------- | ---------------------------------------------------------- |
| Loading                | `Skeleton` inside a Card or list rows — not a blank screen |
| Empty                  | `EmptyState` with icon, title, description, optional CTA   |
| Permission denied      | `PermissionGate` (or PageShell + header + gate card)       |
| Mutation success/error | `toast` (sonner) — no blocking alerts for routine success  |

---

## Confirms

- Always `ConfirmDialog` from dashboard primitives.
- Escape closes when not pending; backdrop click same.
- Destructive actions: `destructive` prop + clear consequence copy.

---

## Filters

- Use `FilterTabs` for status / type filters (Campaigns, Engagement, Team).
- Active: `bg-foreground text-background`; inactive: muted hover.

---

## Do / don’t

**Do**

- Import from `@/components/dashboard`.
- Match Team / Billing / Campaigns density and button sizing.
- Keep one primary work surface per view (create form can expand above the list).

**Don’t**

- Duplicate EmptyState / ConfirmActionDialog locally.
- Add extra `p-*` / `space-y-8` page wrappers that fight the shell.
- Use large CardTitle for page-level headings.
- Invent a new confirm overlay or filter chip style.
- Put platform-admin UI in `apps/loyalty` (belongs in `apps/admin`).

---

## Checklist for new staff pages

1. Wrap in `PageShell` (add `narrow` only for Counter-like ops).
2. Use `PageHeader` with subtitle and `size="sm"` actions.
3. Add `GuideCard` / `StatStrip` only if they earn their space.
4. Loading → Skeleton; no data → `EmptyState`; denied → `PermissionGate`.
5. Confirms → `ConfirmDialog`; filters → `FilterTabs`.
6. Spot-check light and dark mode.

## For planners and agents

Any plan or PR that adds or changes staff UI in `apps/loyalty` **must**:

1. Cite this document as the layout source of truth (not QMS `FRONTEND_GUIDE.md`).
2. Reuse `@/components/dashboard` primitives — no parallel page shells, empties, or confirm overlays.
3. Pass `pnpm check:architecture:loyalty-staff-ui` (included in `pnpm validate:ci`).
4. Treat Counter and Overview as **variants** of this system, not exceptions.

Forbidden on dashboard pages: `window.confirm()`, local `EmptyState` / `ConfirmActionDialog`, raw `DASHBOARD_PAGE_HEADING_CLASS` (use `PageHeader`).

---

## Related

- [LOYALTY_STAFF_COUNTER.md](../operations/LOYALTY_STAFF_COUNTER.md) — Counter product path
- [REPO_BOUNDARIES.md](../architecture/REPO_BOUNDARIES.md) — LMS vs QMS surfaces
- [FRONTEND_GUIDE.md](./FRONTEND_GUIDE.md) — QMS `apps/web` patterns (not LMS source of truth)
- Cursor rule: [`.cursor/rules/loyalty-staff-ui.mdc`](../../.cursor/rules/loyalty-staff-ui.mdc)
- Gate: `scripts/architecture/check-loyalty-staff-ui.mjs`
