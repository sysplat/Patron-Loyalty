/**
 * Seed N waiting customers on step 1 of the City Medical Center phone-demo flow.
 *
 * Prereq: run setup-multistep-phone-demo once (queues + active flow).
 *
 *   pnpm setup:multistep-phone-demo
 *   COUNT=15 pnpm setup:multistep-waiting-load
 *
 * Options:
 *   COUNT=15          — tickets to create (default 15, max 50)
 *   START=16          — first load-test index (default 1)
 *   CLEAR=1           — cancel/remove prior load-test tickets first
 *   REPAIR_STUCK=1    — issue step-2 tickets for load-test visits stuck after step-1 complete
 *   BRANCH_ID=...     — override branch (default City Medical Center)
 *   API_URL=...       — default from .env or http://localhost:4000
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';

config({ path: resolve(__dirname, '../../../.env') });
config({ path: resolve(__dirname, '../../../.env.local') });

const ORG_ID = process.env.ORG_ID ?? 'cf711601-8dcc-4e13-802e-8ab28d297c7a';
const BRANCH_ID = process.env.BRANCH_ID ?? '96b308a2-a399-43a7-ae1e-50c71d697ec0';
const RECEPTION_QUEUE_NAME = process.env.RECEPTION_QUEUE_NAME ?? 'Phone Demo · Reception';
const LAB_QUEUE_NAME = process.env.LAB_QUEUE_NAME ?? 'Phone Demo · Lab';
const SERVICE_CONSULTATION = process.env.SERVICE_ID ?? 'cdc27306-cfa2-43ac-ad30-afcb7ff41e51';
const SERVICE_RADIOLOGY =
  process.env.SERVICE_RADIOLOGY_ID ?? '2f275aef-4130-4375-9b02-521622d297b7';
const COUNT = Math.min(50, Math.max(1, Number.parseInt(process.env.COUNT ?? '15', 10) || 15));
const START = Math.max(1, Number.parseInt(process.env.START ?? '1', 10) || 1);
const CLEAR = process.env.CLEAR === '1';
const REPAIR_STUCK = process.env.REPAIR_STUCK === '1';
const API_URL = (process.env.API_URL || 'http://localhost:4000').replace(/\/$/, '');
const LOAD_NAME_PREFIX = 'Load Test';
const LOAD_PHONE_BASE = '+1604861850';

async function issueViaApi(payload: {
  queueId: string;
  serviceId: string;
  customerName: string;
  customerPhone: string;
  visitId?: string;
  stepIndex?: number;
  externalRef?: string;
}): Promise<{
  ok: boolean;
  displayNumber?: string;
  ticketId?: string;
  visitId?: string;
  error?: string;
}> {
  const url = `${API_URL}/api/v1/tickets/issue`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgId: ORG_ID,
        branchId: BRANCH_ID,
        queueId: payload.queueId,
        serviceId: payload.serviceId,
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        source: 'kiosk',
        stepIndex: payload.stepIndex ?? 1,
        ...(payload.visitId ? { visitId: payload.visitId } : {}),
        ...(payload.externalRef ? { externalRef: payload.externalRef } : {}),
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: JSON.stringify(json) };
    }
    const ticket = json.data ?? json;
    return {
      ok: true,
      displayNumber: ticket.displayNumber,
      ticketId: ticket.id,
      visitId: ticket.visitId,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function repairStuckStepOneVisits(prisma: PrismaClient, labQueueId: string): Promise<void> {
  const stepOneDone = await prisma.ticket.findMany({
    where: {
      orgId: ORG_ID,
      branchId: BRANCH_ID,
      customerName: { startsWith: LOAD_NAME_PREFIX },
      stepIndex: 1,
      status: 'completed',
      visitId: { not: null },
    },
    select: {
      visitId: true,
      displayNumber: true,
      customerName: true,
      customerPhone: true,
      externalRef: true,
    },
  });

  let repaired = 0;
  for (const row of stepOneDone) {
    if (!row.visitId) continue;
    const hasStepTwo = await prisma.ticket.findFirst({
      where: {
        visitId: row.visitId,
        stepIndex: { gte: 2 },
        status: { in: ['waiting', 'called', 'serving'] },
      },
    });
    if (hasStepTwo) continue;

    const result = await issueViaApi({
      queueId: labQueueId,
      serviceId: SERVICE_RADIOLOGY,
      customerName: row.customerName ?? 'Load Test',
      customerPhone: row.customerPhone ?? '',
      visitId: row.visitId,
      stepIndex: 2,
      externalRef: row.externalRef ?? undefined,
    });
    if (result.ok) {
      repaired += 1;
      console.log(
        `  ✓ Repaired ${row.customerName} (${row.displayNumber}) → step 2 #${result.displayNumber}`,
      );
    } else {
      console.warn(`  ✗ Repair ${row.displayNumber}: ${result.error}`);
    }
  }
  console.log(`\n✓ Repaired ${repaired} visit(s) stuck after step 1\n`);
}

async function main() {
  const prisma = new PrismaClient();

  const reception = await prisma.queue.findFirst({
    where: { orgId: ORG_ID, branchId: BRANCH_ID, name: RECEPTION_QUEUE_NAME },
    select: { id: true, name: true, status: true },
  });

  if (!reception) {
    console.error(`Queue "${RECEPTION_QUEUE_NAME}" not found on branch ${BRANCH_ID}.`);
    console.error('Run: pnpm setup:multistep-phone-demo');
    process.exit(1);
  }

  if (reception.status !== 'open') {
    await prisma.queue.update({ where: { id: reception.id }, data: { status: 'open' } });
    console.log(`✓ Opened queue: ${reception.name}`);
  }

  if (REPAIR_STUCK) {
    const lab = await prisma.queue.findFirst({
      where: { orgId: ORG_ID, branchId: BRANCH_ID, name: LAB_QUEUE_NAME },
      select: { id: true, status: true },
    });
    if (!lab) {
      console.error(`Queue "${LAB_QUEUE_NAME}" not found. Run: pnpm setup:multistep-phone-demo`);
      process.exit(1);
    }
    if (lab.status !== 'open') {
      await prisma.queue.update({ where: { id: lab.id }, data: { status: 'open' } });
    }
    console.log('\n--- Repair visits stuck after step 1 complete ---\n');
    await repairStuckStepOneVisits(prisma, lab.id);
    await prisma.$disconnect();
    return;
  }

  if (CLEAR) {
    const removed = await prisma.ticket.updateMany({
      where: {
        orgId: ORG_ID,
        branchId: BRANCH_ID,
        customerName: { startsWith: LOAD_NAME_PREFIX },
        status: { in: ['waiting', 'called', 'serving'] },
      },
      data: { status: 'cancelled' },
    });
    console.log(`✓ Cleared ${removed.count} prior load-test active ticket(s)`);
  }

  const existing = await prisma.ticket.count({
    where: {
      orgId: ORG_ID,
      queueId: reception.id,
      status: 'waiting',
      customerName: { startsWith: LOAD_NAME_PREFIX },
    },
  });

  console.log(
    `\n--- Multi-step waiting load (${COUNT} at step 1, indices ${START}–${START + COUNT - 1}) ---\n`,
  );
  console.log(`Branch: ${BRANCH_ID}`);
  console.log(`Queue:  ${reception.name}`);
  console.log(`Already waiting (load test): ${existing}\n`);

  const issued: string[] = [];
  let failures = 0;

  for (let i = START; i < START + COUNT; i++) {
    const suffix = String(i).padStart(2, '0');
    const customerName = `${LOAD_NAME_PREFIX} ${suffix}`;
    const customerPhone = `${LOAD_PHONE_BASE}${i}`;

    const active = await prisma.ticket.findFirst({
      where: {
        orgId: ORG_ID,
        customerPhone,
        status: { in: ['waiting', 'called', 'serving'] },
      },
    });
    if (active) {
      console.log(`  · Skip ${customerName} — already active (${active.displayNumber})`);
      continue;
    }

    const result = await issueViaApi({
      queueId: reception.id,
      serviceId: SERVICE_CONSULTATION,
      customerName,
      customerPhone,
    });

    if (result.ok) {
      issued.push(result.displayNumber ?? customerName);
      console.log(`  ✓ ${customerName} → #${result.displayNumber}`);
    } else {
      failures += 1;
      console.warn(`  ✗ ${customerName}: ${result.error}`);
    }
  }

  const waitingNow = await prisma.ticket.count({
    where: { queueId: reception.id, status: 'waiting' },
  });

  console.log(`\n--- Done ---`);
  console.log(`Issued: ${issued.length}  Failed: ${failures}`);
  console.log(`Total waiting at reception: ${waitingNow}`);
  console.log(`\nOpen multi-step console:`);
  console.log(`  http://localhost:3001/dashboard/multi-step`);
  console.log(`Select branch "City Medical Center", station 1, line "${reception.name}".`);
  console.log(`Step 1 in Customer journey should show ${waitingNow} waiting.\n`);

  await prisma.$disconnect();
  if (failures > 0 && issued.length === 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
