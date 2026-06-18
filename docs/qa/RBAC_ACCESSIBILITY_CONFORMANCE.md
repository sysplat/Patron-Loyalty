# RBAC Accessibility Levels Conformance

This file maps the accessibility-level model (Owner, Admin, Manager, Staff, Viewer) to the system role matrix in code.

## Source of Truth

- Role matrix: `packages/shared/src/constants/roles.ts`
- Runtime sync: `packages/api/src/common/rbac/system-role-permissions.ts`
- Guard enforcement: `packages/api/src/common/guards/rbac.guard.ts`
- Verification tests:
  - `packages/api/src/common/rbac/system-role-permissions.spec.ts`
  - `scripts/smoke-full-matrix.mjs`
  - `scripts/smoke-rbac-full.mjs`

## Conformance Mapping

- Owner:
  - Org-wide manage permissions including billing/settings/reports.
  - Mapped by `DEFAULT_ROLE_PERMISSIONS.owner`.
- Admin:
  - Org-wide operations, no billing manage.
  - Mapped by `DEFAULT_ROLE_PERMISSIONS.admin`.
- Manager:
  - Branch-scoped operations with branch report access.
  - Mapped by `DEFAULT_ROLE_PERMISSIONS.manager`.
- Staff:
  - Branch execution for ticket and appointment updates.
  - Mapped by `DEFAULT_ROLE_PERMISSIONS.staff`.
- Viewer:
  - Read-only branch visibility.
  - Mapped by `DEFAULT_ROLE_PERMISSIONS.viewer`.

## Explicit Invariants Enforced

The following invariants are unit-tested in `system-role-permissions.spec.ts`:

- Billing manage is owner-only.
- Manager has report read; staff/viewer do not.
- Staff can update ticket/appointment; viewer cannot.

## Runtime Matrix Validation

`pnpm smoke:matrix` validates:

- Role access against core protected endpoints.
- Report overview access by role.
- Advanced report gate behavior by plan.
