/**
 * Surface-separation audit for classic vs journey operations.
 *
 * Usage:
 *   pnpm --filter @queueplatform/database exec tsx scripts/audit-serve-surface-separation.ts
 *   pnpm --filter @queueplatform/database exec tsx scripts/audit-serve-surface-separation.ts --org=<orgId>
 *   pnpm --filter @queueplatform/database exec tsx scripts/audit-serve-surface-separation.ts --repair-profiles
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Args = {
  orgId?: string;
  repairProfiles: boolean;
};

const MARK_READY = 'mark_ready';
const DEFAULT_PICKUP_CAPABILITIES = [
  'mark_ready',
  'call',
  'serve',
  'complete',
  'no_show',
  'cancel',
];
const DEFAULT_COMBINED_CAPABILITIES = [
  'call',
  'serve',
  'complete',
  'no_show',
  'cancel',
  'transfer',
  'mark_ready',
];

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const orgArg = args.find((a) => a.startsWith('--org='));
  return {
    orgId: orgArg?.split('=')[1],
    repairProfiles: args.includes('--repair-profiles'),
  };
}

async function main() {
  const { orgId, repairProfiles } = parseArgs();
  const orgWhere = orgId ? { orgId } : {};

  console.log('--- Surface Separation Audit ---');
  if (orgId) {
    console.log(`Scope: org ${orgId}`);
  } else {
    console.log('Scope: all orgs');
  }

  const classicTicketsOnJourneyQueues = await prisma.ticket.findMany({
    where: {
      ...orgWhere,
      visitId: null,
      status: { in: ['waiting', 'called', 'serving'] },
      queue: {
        OR: [{ journeyModeOverride: 'visit_multi_step' }, { flowTemplateId: { not: null } }],
      },
    },
    select: {
      id: true,
      displayNumber: true,
      status: true,
      queueId: true,
      queue: { select: { name: true, journeyModeOverride: true, flowTemplateId: true } },
    },
    take: 100,
  });

  const journeyTicketsOnClassicQueues = await prisma.ticket.findMany({
    where: {
      ...orgWhere,
      visitId: { not: null },
      queue: {
        journeyModeOverride: { not: 'visit_multi_step' },
        flowTemplateId: null,
      },
    },
    select: {
      id: true,
      displayNumber: true,
      status: true,
      queueId: true,
      visitId: true,
      queue: { select: { name: true } },
    },
    take: 100,
  });

  const activeVisitsWithoutActiveTickets = await prisma.visit.findMany({
    where: {
      ...orgWhere,
      status: 'active',
      tickets: { none: { status: { in: ['waiting', 'called', 'serving'] } } },
    },
    select: {
      id: true,
      orgId: true,
      branchId: true,
      updatedAt: true,
      _count: { select: { tickets: true } },
    },
    take: 100,
  });

  const combinedProfiles = await prisma.stationProfile.findMany({
    where: {
      ...(orgId ? { orgId } : {}),
      name: 'Combined counter',
      flowTemplateId: { not: null },
    },
    select: {
      id: true,
      orgId: true,
      branchId: true,
      flowTemplateId: true,
      queues: {
        select: {
          id: true,
          queueId: true,
          visibilityOnly: true,
          capabilities: true,
          queue: { select: { stepRole: true, callingPolicy: true, name: true } },
        },
      },
    },
  });

  const driftedCombinedRows: Array<{
    stationProfileId: string;
    stationProfileQueueId: string;
    queueId: string;
    queueName: string;
    reason: string;
  }> = [];

  for (const profile of combinedProfiles) {
    for (const row of profile.queues) {
      const isPickup = row.queue.stepRole === 'pickup';
      const needsReady =
        row.queue.callingPolicy === 'ready_then_manual' ||
        row.queue.callingPolicy === 'ready_then_fifo';
      const capabilities = Array.isArray(row.capabilities) ? (row.capabilities as string[]) : [];
      if (row.visibilityOnly) {
        driftedCombinedRows.push({
          stationProfileId: profile.id,
          stationProfileQueueId: row.id,
          queueId: row.queueId,
          queueName: row.queue.name,
          reason: 'visibility_only=true',
        });
        continue;
      }
      if (isPickup && needsReady && !capabilities.includes(MARK_READY)) {
        driftedCombinedRows.push({
          stationProfileId: profile.id,
          stationProfileQueueId: row.id,
          queueId: row.queueId,
          queueName: row.queue.name,
          reason: 'pickup_ready_lane_missing_mark_ready',
        });
      }
    }
  }

  console.log('\nClassic tickets on journey queues:', classicTicketsOnJourneyQueues.length);
  console.log('Journey tickets on classic queues:', journeyTicketsOnClassicQueues.length);
  console.log('Active visits without active tickets:', activeVisitsWithoutActiveTickets.length);
  console.log('Drifted combined-profile rows:', driftedCombinedRows.length);

  if (classicTicketsOnJourneyQueues.length) {
    console.log('\nSample classic tickets on journey queues:');
    for (const t of classicTicketsOnJourneyQueues.slice(0, 10)) {
      console.log(`- ${t.id} #${t.displayNumber} (${t.status}) queue=${t.queue.name}`);
    }
  }
  if (journeyTicketsOnClassicQueues.length) {
    console.log('\nSample journey tickets on classic queues:');
    for (const t of journeyTicketsOnClassicQueues.slice(0, 10)) {
      console.log(
        `- ${t.id} #${t.displayNumber} (${t.status}) queue=${t.queue.name} visit=${t.visitId}`,
      );
    }
  }
  if (activeVisitsWithoutActiveTickets.length) {
    console.log('\nSample active visits without active tickets:');
    for (const v of activeVisitsWithoutActiveTickets.slice(0, 10)) {
      console.log(
        `- ${v.id} branch=${v.branchId} tickets=${v._count.tickets} updated=${v.updatedAt.toISOString()}`,
      );
    }
  }

  if (repairProfiles && driftedCombinedRows.length > 0) {
    console.log('\nRepair mode enabled: fixing drifted Combined counter rows...');
    let fixed = 0;
    for (const row of driftedCombinedRows) {
      const isPickupReason = row.reason.includes('pickup');
      await prisma.stationProfileQueue.update({
        where: { id: row.stationProfileQueueId },
        data: {
          visibilityOnly: false,
          capabilities: isPickupReason
            ? DEFAULT_PICKUP_CAPABILITIES
            : DEFAULT_COMBINED_CAPABILITIES,
        },
      });
      fixed += 1;
    }
    console.log(`Repaired ${fixed} station profile rows.`);
  } else if (driftedCombinedRows.length > 0) {
    console.log('\nRun with --repair-profiles to auto-fix Combined counter drift.');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
