/**
 * Seed N waiting customers on the single-step "Single Desk" queue.
 *
 * Prereq: run setup:single-desk-kiosk once for the branch.
 *
 *   pnpm setup:single-desk-kiosk
 *   BRANCH_NAME="City Medical Center" COUNT=6 pnpm setup:single-waiting-load
 *
 * Options:
 *   COUNT=6           — tickets to create (default 6, max 30)
 *   CLEAR=1           — cancel prior single-step load-test tickets first
 *   BRANCH_NAME=...   — default "City Medical Center"
 *   QUEUE_NAME=...    — default "Single Desk"
 *   API_URL=...       — default from .env or http://localhost:4000
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';

config({ path: resolve(__dirname, '../../../.env') });
config({ path: resolve(__dirname, '../../../.env.local') });

const BRANCH_NAME = process.env.BRANCH_NAME?.trim() || 'City Medical Center';
const QUEUE_NAME = process.env.QUEUE_NAME?.trim() || 'Single Desk';
const COUNT = Math.min(30, Math.max(1, Number.parseInt(process.env.COUNT ?? '6', 10) || 6));
const CLEAR = process.env.CLEAR === '1';
const API_URL = (process.env.API_URL || 'http://localhost:4000').replace(/\/$/, '');
const LOAD_NAME_PREFIX = 'Single Load';
const LOAD_PHONE_BASE = '+1604861900';

async function issueViaApi(payload: {
  orgId: string;
  branchId: string;
  queueId: string;
  serviceId: string;
  customerName: string;
  customerPhone: string;
}): Promise<{ ok: boolean; displayNumber?: string; error?: string }> {
  const url = `${API_URL}/api/v1/tickets/issue`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgId: payload.orgId,
        branchId: payload.branchId,
        queueId: payload.queueId,
        serviceId: payload.serviceId,
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        source: 'kiosk',
        stepIndex: 1,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: JSON.stringify(json) };
    }
    const ticket = json.data ?? json;
    return { ok: true, displayNumber: ticket.displayNumber };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function main() {
  const prisma = new PrismaClient();

  const branch = await prisma.branch.findFirst({
    where: { name: BRANCH_NAME },
    select: { id: true, name: true, orgId: true },
  });
  if (!branch) {
    console.error(`Branch "${BRANCH_NAME}" not found.`);
    console.error('Run: LIST_ORGS=1 pnpm setup:single-desk-kiosk');
    process.exit(1);
  }

  const queue = await prisma.queue.findFirst({
    where: { orgId: branch.orgId, branchId: branch.id, name: QUEUE_NAME },
    select: { id: true, name: true, status: true, serviceId: true, prefix: true },
  });
  if (!queue?.serviceId) {
    console.error(`Queue "${QUEUE_NAME}" not found on "${branch.name}".`);
    console.error(`Run: BRANCH_NAME="${BRANCH_NAME}" pnpm setup:single-desk-kiosk`);
    process.exit(1);
  }

  if (queue.status !== 'open') {
    await prisma.queue.update({ where: { id: queue.id }, data: { status: 'open' } });
    console.log(`✓ Opened queue: ${queue.name}`);
  }

  if (CLEAR) {
    const removed = await prisma.ticket.updateMany({
      where: {
        orgId: branch.orgId,
        branchId: branch.id,
        customerName: { startsWith: LOAD_NAME_PREFIX },
        status: { in: ['waiting', 'called', 'serving'] },
      },
      data: { status: 'cancelled' },
    });
    console.log(`✓ Cleared ${removed.count} prior single-step load-test ticket(s)`);
  }

  const existing = await prisma.ticket.count({
    where: {
      orgId: branch.orgId,
      queueId: queue.id,
      status: 'waiting',
      customerName: { startsWith: LOAD_NAME_PREFIX },
    },
  });

  console.log(`\n--- Single-step waiting load (${COUNT}) ---\n`);
  console.log(`Branch: ${branch.name} (${branch.id})`);
  console.log(`Queue:  ${queue.name} (${queue.prefix}-###)`);
  console.log(`Already waiting (load test): ${existing}\n`);

  const issued: string[] = [];
  let failures = 0;

  for (let i = 1; i <= COUNT; i++) {
    const suffix = String(i).padStart(2, '0');
    const customerName = `${LOAD_NAME_PREFIX} ${suffix}`;
    const customerPhone = `${LOAD_PHONE_BASE}${i}`;

    const active = await prisma.ticket.findFirst({
      where: {
        orgId: branch.orgId,
        customerPhone,
        status: { in: ['waiting', 'called', 'serving'] },
      },
    });
    if (active) {
      console.log(`  · Skip ${customerName} — already active (${active.displayNumber})`);
      continue;
    }

    const result = await issueViaApi({
      orgId: branch.orgId,
      branchId: branch.id,
      queueId: queue.id,
      serviceId: queue.serviceId,
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
    where: { queueId: queue.id, status: 'waiting' },
  });

  console.log(`\n--- Done ---`);
  console.log(`Issued: ${issued.length}  Failed: ${failures}`);
  console.log(`Total waiting at "${queue.name}": ${waitingNow}`);
  console.log(`\nOpen single-step console:`);
  console.log(`  http://localhost:3001/dashboard/single-step`);
  console.log(`Select branch "${branch.name}", queue "${queue.name}", desk 1.\n`);

  await prisma.$disconnect();
  if (failures > 0 && issued.length === 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
