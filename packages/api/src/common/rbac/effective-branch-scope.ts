import { PrismaService } from '../../prisma/prisma.service';
import { SYSTEM_ROLES } from '@queueplatform/shared';

/**
 * Resolves which branch rows a principal may see for list/filter operations.
 * - `null` — all branches in the org (organization owner or org-wide admin assignment).
 * - non-empty `string[]` — only those branch ids (e.g. manager/staff/viewer assignments).
 * - `[]` — no visible branches (no assignments, or no branch ids on record).
 */
export async function resolveAllowedBranchIds(
  prisma: PrismaService,
  orgId: string,
  userId: string,
): Promise<string[] | null> {
  const assignments = await prisma.withTenant(orgId, (tx) =>
    tx.roleAssignment.findMany({
      where: { userId, role: { orgId } },
      select: { branchId: true, role: { select: { name: true } } },
    }),
  );

  let hasOrgWidePrivilegedAssignment = false;
  const branchIds = new Set<string>();

  for (const assignment of assignments) {
    const roleName = assignment.role.name;
    if (
      assignment.branchId === null &&
      (roleName === SYSTEM_ROLES.OWNER || roleName === SYSTEM_ROLES.ADMIN)
    ) {
      hasOrgWidePrivilegedAssignment = true;
    }
    if (assignment.branchId) {
      branchIds.add(assignment.branchId);
    }
  }

  if (hasOrgWidePrivilegedAssignment) {
    return null;
  }

  return [...branchIds];
}
