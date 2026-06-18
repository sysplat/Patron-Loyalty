# Manual QA Matrix (Pre-Release)

Use this matrix on Railway staging for final visual and interaction validation.
Automated evidence linked here was already executed on this release branch.

## Admin Dashboard

- Organization profile (`/dashboard/organization`)
  - Create/update org fields, timezone, validation messages.
- Branches (`/dashboard/branches`)
  - Create/update/delete branch, verify list refresh.
- Services (`/dashboard/services`)
  - Create/update/delete service, queue/appointment toggles.
- Queues (`/dashboard/queues`)
  - Create/update/delete queue, open/close, branch scoping.
  - Verify flow-linked queues show policy lock guidance and cannot edit queue type/calling rule until unlinked.
- Flows (`/dashboard/flows`)
  - Create/update/activate template, confirm activation summary and station profile updates.
- Desks + operations (`/dashboard/operations`, `/dashboard/agent`)
  - Desk assignment, call-next, serving, complete/no-show paths.
  - Multi-step workbench (`/dashboard/multi-step`) verifies step pipeline, row actions, and branch gates board bulk actions.
- Users/Roles (`/dashboard/users`)
  - Invite, role assign/rotate, branch-scoped role checks.
- Announcements (`/dashboard/announcements`)
  - Create/update/delete, display board visibility.
- Reports (`/dashboard/reports`)
  - Overview on all plans, advanced report panels enterprise-only.
- Billing (`/dashboard/billing`)
  - Plan switch flow, invoices/portal links, limits refresh.
- Settings (`/dashboard/settings`)
  - Save/update settings, persistence and permission boundaries.

## Customer Flows

- Kiosk ticket issue (`/kiosk/[branchId]`)
  - Valid issue, validation errors, queue closed behavior.
- Appointment booking (`/book/[branchId]`)
  - Slot listing, booking success, collision/retry behavior.
- Ticket tracking (`/track/[ticketId]`)
  - Status transitions and polling updates.
- Appointment tracking (`/track/appointment/[id]`)
  - Status card, cancel action and guard rails.
- Customer portal (`/track/portal`)
  - Branch-scoped lookup by branch ID + email/phone.

## Public Display / TV

- Public board (`/display/[branchId]`)
  - Called/serving rows render correctly.
  - Waiting count updates.
  - No customer PII fields exposed.
- Dashboard display setup (`/dashboard/display`)
  - Pairing URL and instructions are correct for branch.

## Cross-Browser and Responsive

- Mandatory browsers: Chrome, Safari, Firefox.
- Mandatory breakpoints: mobile (<640), tablet (768-1024), desktop (>1280).
- Confirm for: login/signup, dashboard home, queues, reports, display, kiosk/book, track pages.

## Accessibility and UX

- Keyboard navigation order on critical forms.
- Focus ring visibility for all interactive elements.
- Empty states, loading states, and API-error states.
- Confirmation flows for destructive actions.

## Automated Evidence Completed

- `pnpm turbo run lint typecheck test build`
- `pnpm test:auth-email-flows`
- `pnpm smoke:matrix`
- `pnpm smoke:rbac-e2e`
- `pnpm bench:reports`
- `pnpm load:issue`
- `pnpm load:join`
