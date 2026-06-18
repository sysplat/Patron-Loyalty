import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';

/** Receipt/POS refs from visit row or any ticket in the visit (including completed earlier steps). */
export async function resolveWorkbenchVisitExternalRefs(
  orgId: string,
  visitIds: string[],
  tx: Prisma.TransactionClient | PrismaService,
): Promise<Map<string, string>> {
  const uniqueVisitIds = [...new Set(visitIds)];
  if (!uniqueVisitIds.length) return new Map();

  const map = new Map<string, string>();

  const visits = await tx.visit.findMany({
    where: { orgId, id: { in: uniqueVisitIds }, externalRef: { not: null } },
    select: { id: true, externalRef: true },
  });
  for (const visit of visits) {
    const ref = visit.externalRef?.trim();
    if (ref) map.set(visit.id, ref);
  }

  const rows = await tx.ticket.findMany({
    where: { orgId, visitId: { in: uniqueVisitIds }, externalRef: { not: null } },
    select: { visitId: true, externalRef: true, bookedAt: true },
    orderBy: { bookedAt: 'desc' },
  });

  for (const row of rows) {
    const ref = row.externalRef?.trim();
    if (row.visitId && ref && !map.has(row.visitId)) {
      map.set(row.visitId, ref);
    }
  }
  return map;
}
