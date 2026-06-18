// ─── System Roles ────────────────────────────────

export const SYSTEM_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MANAGER: 'manager',
  STAFF: 'staff',
  VIEWER: 'viewer',
} as const;

export type SystemRole = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];

// ─── Permission Resources ────────────────────────

export const RESOURCES = {
  ORGANIZATION: 'organization',
  BRANCH: 'branch',
  SERVICE: 'service',
  QUEUE: 'queue',
  TICKET: 'ticket',
  APPOINTMENT: 'appointment',
  DESK: 'desk',
  ANNOUNCEMENT: 'announcement',
  USER: 'user',
  ROLE: 'role',
  REPORT: 'report',
  BILLING: 'billing',
  DISPLAY: 'display',
  NOTIFICATION: 'notification',
  SETTINGS: 'settings',
  REVIEW: 'review',
  CUSTOMER: 'customer',
  STATION_PROFILE: 'station_profile',
} as const;

export type Resource = (typeof RESOURCES)[keyof typeof RESOURCES];

// ─── Permission Actions ──────────────────────────

export const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  MANAGE: 'manage',
} as const;

export type Action = (typeof ACTIONS)[keyof typeof ACTIONS];
export type PermissionScope = 'own' | 'branch' | 'org';

// ─── Default Role Permissions ────────────────────
// Backend RBAC source of truth: org-scoped rows require an org-wide role assignment (branchId null).
// Branch-scoped rows require a branch context or an explicit “list without branch” allowance in the API guard.
// Owner: full control including billing, org profile, and destructive operations.
// Admin: org operations without billing, organization profile edits (owner only), sensitive deletes, or owner assignment.
// Manager / staff / viewer: branch-tied visibility and operations only where listed.

export const SYSTEM_ROLE_DESCRIPTIONS: Record<SystemRole, string> = {
  [SYSTEM_ROLES.OWNER]:
    'Full platform access across all branches, billing, organization identity, password governance, and destructive administration.',
  [SYSTEM_ROLES.ADMIN]:
    'Organization-wide operations and staffing without billing access, editing organization profile (owner only), owner assignment, or destructive deletes on sensitive entities.',
  [SYSTEM_ROLES.MANAGER]:
    'Branch-scoped daily operations, scheduling, team visibility, and reporting for explicitly assigned branches only.',
  [SYSTEM_ROLES.STAFF]: 'Frontline queue and appointment execution for the assigned branch.',
  [SYSTEM_ROLES.VIEWER]:
    'Read-only visibility across assigned branches (queues, tickets, appointments, services, reports, etc.) — no create, update, or delete.',
};

export const DEFAULT_ROLE_PERMISSIONS: Record<
  SystemRole,
  Array<{ resource: Resource; action: Action; scope: PermissionScope }>
> = {
  [SYSTEM_ROLES.OWNER]: [
    { resource: RESOURCES.ORGANIZATION, action: ACTIONS.MANAGE, scope: 'org' },
    { resource: RESOURCES.BRANCH, action: ACTIONS.MANAGE, scope: 'org' },
    { resource: RESOURCES.SERVICE, action: ACTIONS.MANAGE, scope: 'org' },
    { resource: RESOURCES.QUEUE, action: ACTIONS.MANAGE, scope: 'org' },
    { resource: RESOURCES.TICKET, action: ACTIONS.MANAGE, scope: 'org' },
    { resource: RESOURCES.APPOINTMENT, action: ACTIONS.MANAGE, scope: 'org' },
    { resource: RESOURCES.DESK, action: ACTIONS.MANAGE, scope: 'org' },
    { resource: RESOURCES.ANNOUNCEMENT, action: ACTIONS.MANAGE, scope: 'org' },
    { resource: RESOURCES.USER, action: ACTIONS.MANAGE, scope: 'org' },
    { resource: RESOURCES.ROLE, action: ACTIONS.MANAGE, scope: 'org' },
    { resource: RESOURCES.REPORT, action: ACTIONS.MANAGE, scope: 'org' },
    { resource: RESOURCES.BILLING, action: ACTIONS.MANAGE, scope: 'org' },
    { resource: RESOURCES.DISPLAY, action: ACTIONS.MANAGE, scope: 'org' },
    { resource: RESOURCES.NOTIFICATION, action: ACTIONS.MANAGE, scope: 'org' },
    { resource: RESOURCES.SETTINGS, action: ACTIONS.MANAGE, scope: 'org' },
    { resource: RESOURCES.REVIEW, action: ACTIONS.MANAGE, scope: 'org' },
    { resource: RESOURCES.CUSTOMER, action: ACTIONS.MANAGE, scope: 'org' },
    { resource: RESOURCES.STATION_PROFILE, action: ACTIONS.MANAGE, scope: 'org' },
  ],
  [SYSTEM_ROLES.ADMIN]: [
    { resource: RESOURCES.ORGANIZATION, action: ACTIONS.READ, scope: 'org' },
    /** Lets admins PATCH org for visit journeys; profile fields remain owner-only in OrganizationService. */
    { resource: RESOURCES.ORGANIZATION, action: ACTIONS.UPDATE, scope: 'org' },
    { resource: RESOURCES.BRANCH, action: ACTIONS.READ, scope: 'org' },
    { resource: RESOURCES.BRANCH, action: ACTIONS.CREATE, scope: 'org' },
    { resource: RESOURCES.BRANCH, action: ACTIONS.UPDATE, scope: 'org' },
    { resource: RESOURCES.SERVICE, action: ACTIONS.MANAGE, scope: 'org' },
    { resource: RESOURCES.QUEUE, action: ACTIONS.MANAGE, scope: 'org' },
    { resource: RESOURCES.TICKET, action: ACTIONS.MANAGE, scope: 'org' },
    { resource: RESOURCES.APPOINTMENT, action: ACTIONS.MANAGE, scope: 'org' },
    { resource: RESOURCES.DESK, action: ACTIONS.MANAGE, scope: 'org' },
    { resource: RESOURCES.ANNOUNCEMENT, action: ACTIONS.MANAGE, scope: 'org' },
    { resource: RESOURCES.USER, action: ACTIONS.READ, scope: 'org' },
    { resource: RESOURCES.USER, action: ACTIONS.CREATE, scope: 'org' },
    { resource: RESOURCES.USER, action: ACTIONS.UPDATE, scope: 'org' },
    { resource: RESOURCES.ROLE, action: ACTIONS.READ, scope: 'org' },
    { resource: RESOURCES.ROLE, action: ACTIONS.CREATE, scope: 'org' },
    { resource: RESOURCES.ROLE, action: ACTIONS.UPDATE, scope: 'org' },
    { resource: RESOURCES.REPORT, action: ACTIONS.READ, scope: 'org' },
    { resource: RESOURCES.DISPLAY, action: ACTIONS.MANAGE, scope: 'org' },
    { resource: RESOURCES.NOTIFICATION, action: ACTIONS.MANAGE, scope: 'org' },
    { resource: RESOURCES.SETTINGS, action: ACTIONS.READ, scope: 'org' },
    { resource: RESOURCES.SETTINGS, action: ACTIONS.UPDATE, scope: 'org' },
    { resource: RESOURCES.REVIEW, action: ACTIONS.READ, scope: 'org' },
    { resource: RESOURCES.REVIEW, action: ACTIONS.UPDATE, scope: 'org' },
    { resource: RESOURCES.CUSTOMER, action: ACTIONS.READ, scope: 'org' },
    { resource: RESOURCES.CUSTOMER, action: ACTIONS.UPDATE, scope: 'org' },
    { resource: RESOURCES.STATION_PROFILE, action: ACTIONS.MANAGE, scope: 'org' },
  ],
  [SYSTEM_ROLES.MANAGER]: [
    { resource: RESOURCES.BRANCH, action: ACTIONS.READ, scope: 'branch' },
    { resource: RESOURCES.BRANCH, action: ACTIONS.UPDATE, scope: 'branch' },
    { resource: RESOURCES.SERVICE, action: ACTIONS.READ, scope: 'branch' },
    { resource: RESOURCES.QUEUE, action: ACTIONS.MANAGE, scope: 'branch' },
    { resource: RESOURCES.TICKET, action: ACTIONS.MANAGE, scope: 'branch' },
    { resource: RESOURCES.APPOINTMENT, action: ACTIONS.MANAGE, scope: 'branch' },
    { resource: RESOURCES.DESK, action: ACTIONS.MANAGE, scope: 'branch' },
    { resource: RESOURCES.ANNOUNCEMENT, action: ACTIONS.MANAGE, scope: 'branch' },
    { resource: RESOURCES.USER, action: ACTIONS.READ, scope: 'branch' },
    { resource: RESOURCES.USER, action: ACTIONS.UPDATE, scope: 'branch' },
    { resource: RESOURCES.REPORT, action: ACTIONS.READ, scope: 'branch' },
    { resource: RESOURCES.DISPLAY, action: ACTIONS.MANAGE, scope: 'branch' },
    { resource: RESOURCES.REVIEW, action: ACTIONS.READ, scope: 'branch' },
    { resource: RESOURCES.REVIEW, action: ACTIONS.UPDATE, scope: 'branch' },
    { resource: RESOURCES.CUSTOMER, action: ACTIONS.READ, scope: 'branch' },
    { resource: RESOURCES.CUSTOMER, action: ACTIONS.UPDATE, scope: 'branch' },
    { resource: RESOURCES.STATION_PROFILE, action: ACTIONS.MANAGE, scope: 'branch' },
  ],
  [SYSTEM_ROLES.STAFF]: [
    { resource: RESOURCES.BRANCH, action: ACTIONS.READ, scope: 'branch' },
    { resource: RESOURCES.SERVICE, action: ACTIONS.READ, scope: 'branch' },
    { resource: RESOURCES.QUEUE, action: ACTIONS.READ, scope: 'branch' },
    { resource: RESOURCES.QUEUE, action: ACTIONS.UPDATE, scope: 'branch' },
    { resource: RESOURCES.TICKET, action: ACTIONS.CREATE, scope: 'branch' },
    { resource: RESOURCES.TICKET, action: ACTIONS.UPDATE, scope: 'branch' },
    { resource: RESOURCES.TICKET, action: ACTIONS.READ, scope: 'branch' },
    { resource: RESOURCES.APPOINTMENT, action: ACTIONS.READ, scope: 'branch' },
    { resource: RESOURCES.APPOINTMENT, action: ACTIONS.UPDATE, scope: 'branch' },
    { resource: RESOURCES.DESK, action: ACTIONS.READ, scope: 'branch' },
    /** Assigned staff open/close their desk on the serve page (scoped to assigned desks in DeskService). */
    { resource: RESOURCES.DESK, action: ACTIONS.UPDATE, scope: 'branch' },
    { resource: RESOURCES.DISPLAY, action: ACTIONS.READ, scope: 'branch' },
    { resource: RESOURCES.CUSTOMER, action: ACTIONS.READ, scope: 'branch' },
    { resource: RESOURCES.STATION_PROFILE, action: ACTIONS.READ, scope: 'branch' },
  ],
  [SYSTEM_ROLES.VIEWER]: [
    { resource: RESOURCES.BRANCH, action: ACTIONS.READ, scope: 'branch' },
    { resource: RESOURCES.SERVICE, action: ACTIONS.READ, scope: 'branch' },
    { resource: RESOURCES.QUEUE, action: ACTIONS.READ, scope: 'branch' },
    { resource: RESOURCES.TICKET, action: ACTIONS.READ, scope: 'branch' },
    { resource: RESOURCES.APPOINTMENT, action: ACTIONS.READ, scope: 'branch' },
    { resource: RESOURCES.DESK, action: ACTIONS.READ, scope: 'branch' },
    { resource: RESOURCES.ANNOUNCEMENT, action: ACTIONS.READ, scope: 'branch' },
    { resource: RESOURCES.REPORT, action: ACTIONS.READ, scope: 'branch' },
    { resource: RESOURCES.REVIEW, action: ACTIONS.READ, scope: 'branch' },
    { resource: RESOURCES.DISPLAY, action: ACTIONS.READ, scope: 'branch' },
    { resource: RESOURCES.CUSTOMER, action: ACTIONS.READ, scope: 'branch' },
    { resource: RESOURCES.STATION_PROFILE, action: ACTIONS.READ, scope: 'branch' },
  ],
};
