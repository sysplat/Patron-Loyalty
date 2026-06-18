import { ForbiddenException } from '@nestjs/common';
import {
  assignRoleForbiddenMessage,
  canActorAssignRole,
  canActorManageUserWithRole,
  manageUserForbiddenMessage,
  normalizeSystemRoleName,
  systemRoleRank,
  type SystemRole,
} from '@queueplatform/shared';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type RbacPrismaClient = PrismaService | Prisma.TransactionClient;

/** Run RBAC queries under tenant RLS when the client supports it. */
export async function withOrgRbac<T>(
  prisma: RbacPrismaClient,
  orgId: string,
  fn: (client: RbacPrismaClient) => Promise<T>,
): Promise<T> {
  // Only the top-level PrismaService can open a transaction. An interactive
  // transaction client (`tx`) inherits `withTenant` via the prototype but has no
  // `$transaction`, so calling `withTenant` on it would throw
  // "this.$transaction is not a function". When we're already inside a transaction
  // the caller has set the RLS org context, so run `fn` directly on `tx`.
  const canOpenTransaction =
    typeof (prisma as PrismaService).withTenant === 'function' &&
    typeof (prisma as { $transaction?: unknown }).$transaction === 'function';
  if (canOpenTransaction) {
    return (prisma as PrismaService).withTenant(orgId, fn);
  }
  return fn(prisma);
}

/** Highest system role assigned to a user in the org (for hierarchy checks). */
export async function resolveUserHighestSystemRole(
  prisma: RbacPrismaClient,
  orgId: string,
  userId: string,
): Promise<SystemRole | null> {
  const assignments = await withOrgRbac(prisma, orgId, (client) =>
    client.roleAssignment.findMany({
      where: { userId, role: { orgId, isSystemRole: true } },
      include: { role: { select: { name: true } } },
    }),
  );

  let best: SystemRole | null = null;
  let bestRank = 0;
  for (const assignment of assignments) {
    const role = normalizeSystemRoleName(assignment.role.name);
    if (!role) continue;
    const rank = systemRoleRank(role);
    if (rank > bestRank) {
      bestRank = rank;
      best = role;
    }
  }
  return best;
}

export async function assertActorMayAssignRoleName(
  prisma: PrismaService,
  orgId: string,
  actorUserId: string,
  targetRoleName: string,
): Promise<void> {
  const actorRole = await resolveUserHighestSystemRole(prisma, orgId, actorUserId);
  if (!canActorAssignRole(actorRole, targetRoleName)) {
    throw new ForbiddenException(assignRoleForbiddenMessage(actorRole, targetRoleName));
  }
}

export async function assertActorMayAssignRoleId(
  prisma: PrismaService,
  orgId: string,
  actorUserId: string,
  targetRoleId: string,
): Promise<void> {
  const role = await prisma.withTenant(orgId, (tx) =>
    tx.role.findFirst({
      where: { id: targetRoleId, orgId },
      select: { name: true },
    }),
  );
  if (!role) {
    throw new ForbiddenException('Role not found in this organization');
  }
  await assertActorMayAssignRoleName(prisma, orgId, actorUserId, role.name);
}

export async function assertActorMayManageTargetUser(
  prisma: PrismaService,
  orgId: string,
  actorUserId: string,
  targetUserId: string,
): Promise<void> {
  const [actorRole, targetRole] = await Promise.all([
    resolveUserHighestSystemRole(prisma, orgId, actorUserId),
    resolveUserHighestSystemRole(prisma, orgId, targetUserId),
  ]);
  if (!canActorManageUserWithRole(actorRole, targetRole)) {
    throw new ForbiddenException(manageUserForbiddenMessage(actorRole, targetRole));
  }
}
