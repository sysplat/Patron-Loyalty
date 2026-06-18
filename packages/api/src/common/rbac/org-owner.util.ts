import {
  SYSTEM_ROLES,
  isSupervisorSystemRole,
  normalizeSystemRoleName,
} from '@queueplatform/shared';

import {
  resolveUserHighestSystemRole,
  withOrgRbac,
  type RbacPrismaClient,
} from './role-assignment-authorization';

/** True when the user has the organization-scoped owner system role assignment. */
export async function userIsOrganizationOwner(
  prisma: RbacPrismaClient,
  orgId: string,
  userId: string,
): Promise<boolean> {
  const ownerRole = await withOrgRbac(prisma, orgId, (client) =>
    client.role.findFirst({
      where: { orgId, name: SYSTEM_ROLES.OWNER, isSystemRole: true },
      select: { id: true },
    }),
  );
  if (!ownerRole) return false;

  const assignment = await withOrgRbac(prisma, orgId, (client) =>
    client.roleAssignment.findFirst({
      where: { userId, roleId: ownerRole.id },
      select: { id: true },
    }),
  );
  return Boolean(assignment);
}

/** True when the user's highest assigned role in the org is owner or admin. */
export async function userIsOrganizationOwnerOrAdmin(
  prisma: RbacPrismaClient,
  orgId: string,
  userId: string,
): Promise<boolean> {
  const highest = await resolveUserHighestSystemRole(prisma, orgId, userId);
  if (highest === SYSTEM_ROLES.OWNER || highest === SYSTEM_ROLES.ADMIN) {
    return true;
  }

  const assignments = await withOrgRbac(prisma, orgId, (client) =>
    client.roleAssignment.findMany({
      where: { userId, role: { orgId } },
      select: { role: { select: { name: true } } },
    }),
  );
  return assignments.some((assignment) => {
    const role = normalizeSystemRoleName(assignment.role.name);
    return role === SYSTEM_ROLES.OWNER || role === SYSTEM_ROLES.ADMIN;
  });
}

/** True when the user's highest assigned role in the org is owner/admin/manager. */
export async function userIsOrganizationSupervisor(
  prisma: RbacPrismaClient,
  orgId: string,
  userId: string,
): Promise<boolean> {
  const highest = await resolveUserHighestSystemRole(prisma, orgId, userId);
  if (isSupervisorSystemRole(highest)) return true;

  const assignments = await withOrgRbac(prisma, orgId, (client) =>
    client.roleAssignment.findMany({
      where: { userId, role: { orgId } },
      select: { role: { select: { name: true } } },
    }),
  );
  return assignments.some((assignment) => isSupervisorSystemRole(assignment.role.name));
}

/**
 * Row-level Call on FIFO / ready_then_fifo queues.
 * Owner and admin: any branch. Manager: assigned branch only. Staff and viewer: never.
 */
export async function userCanUseFifoManualCall(
  prisma: RbacPrismaClient,
  orgId: string,
  userId: string,
  branchId: string,
): Promise<boolean> {
  if (await userIsOrganizationOwnerOrAdmin(prisma, orgId, userId)) {
    return true;
  }

  const assignments = await withOrgRbac(prisma, orgId, (client) =>
    client.roleAssignment.findMany({
      where: { userId, role: { orgId } },
      select: { branchId: true, role: { select: { name: true } } },
    }),
  );

  return assignments.some((assignment) => {
    const role = normalizeSystemRoleName(assignment.role.name);
    return role === SYSTEM_ROLES.MANAGER && assignment.branchId === branchId;
  });
}
