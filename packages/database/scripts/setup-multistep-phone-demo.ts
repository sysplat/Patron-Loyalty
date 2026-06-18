/**
 * Idempotent demo: multi-step queues + flow + step-1 ticket for +16048618530.
 * Run: pnpm --filter @queueplatform/database exec tsx scripts/setup-multistep-phone-demo.ts
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';

config({ path: resolve(__dirname, '../../../.env') });

const ORG_ID = 'cf711601-8dcc-4e13-802e-8ab28d297c7a';
const BRANCH_ID = '96b308a2-a399-43a7-ae1e-50c71d697ec0';
const PHONE_E164 = '+16048618530';
const CUSTOMER_NAME = 'Parsa Demo';
const FLOW_NAME = 'Phone Demo Journey (6048618530)';
const API_URL = (process.env.API_URL || 'http://localhost:4000').replace(/\/$/, '');

const SERVICES = {
  consultation: 'cdc27306-cfa2-43ac-ad30-afcb7ff41e51',
  radiology: '2f275aef-4130-4375-9b02-521622d297b7',
  pharmacy: '90d3bbbb-d222-40de-b5be-43117ed2bff0',
} as const;

const QUEUE_SPECS = [
  {
    key: 'reception',
    name: 'Phone Demo · Reception',
    prefix: 'PD1',
    serviceId: SERVICES.consultation,
    stepRole: 'service',
    callingPolicy: 'fifo',
  },
  {
    key: 'lab',
    name: 'Phone Demo · Lab',
    prefix: 'PD2',
    serviceId: SERVICES.radiology,
    stepRole: 'service',
    callingPolicy: 'fifo',
  },
  {
    key: 'pharmacy',
    name: 'Phone Demo · Pharmacy Pickup',
    prefix: 'PD3',
    serviceId: SERVICES.pharmacy,
    stepRole: 'pickup',
    callingPolicy: 'ready_then_manual',
  },
] as const;

async function upsertQueue(
  prisma: PrismaClient,
  spec: (typeof QUEUE_SPECS)[number],
): Promise<string> {
  const existing = await prisma.queue.findFirst({
    where: { orgId: ORG_ID, branchId: BRANCH_ID, name: spec.name },
  });

  if (existing) {
    await prisma.queue.update({
      where: { id: existing.id },
      data: {
        serviceId: spec.serviceId,
        journeyModeOverride: 'visit_multi_step',
        stepRole: spec.stepRole,
        callingPolicy: spec.callingPolicy,
        status: 'open',
      },
    });
    console.log(`✓ Updated queue: ${spec.name}`);
    return existing.id;
  }

  const created = await prisma.queue.create({
    data: {
      orgId: ORG_ID,
      branchId: BRANCH_ID,
      serviceId: spec.serviceId,
      name: spec.name,
      prefix: spec.prefix,
      journeyModeOverride: 'visit_multi_step',
      stepRole: spec.stepRole,
      callingPolicy: spec.callingPolicy,
      status: 'open',
      maxServiceMinutes: 15,
      minServiceMinutes: 5,
    },
  });
  console.log(`✓ Created queue: ${spec.name}`);
  return created.id;
}

async function issueTicketViaApi(queueId: string): Promise<void> {
  const url = `${API_URL}/api/v1/tickets/issue`;
  const body = {
    orgId: ORG_ID,
    branchId: BRANCH_ID,
    queueId,
    serviceId: SERVICES.consultation,
    customerPhone: PHONE_E164,
    customerName: CUSTOMER_NAME,
    source: 'kiosk',
    stepIndex: 1,
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn(`⚠ Could not issue ticket via API (${res.status}):`, json);
      console.warn(`  Start the API and run again, or book at /book/${BRANCH_ID}`);
      return;
    }
    const ticket = json.data ?? json;
    console.log(`✓ Issued step-1 ticket via API:`);
    console.log(`  Display: ${ticket.displayNumber}`);
    console.log(`  Ticket id: ${ticket.id}`);
    if (ticket.visitId) {
      console.log(`  Visit: http://localhost:3001/track/visit/${ticket.visitId}`);
    }
  } catch (err) {
    console.warn(
      '⚠ API not reachable — start `pnpm dev` (API on :4000) and re-run to auto-issue a ticket.',
    );
    console.warn(`  Or book manually: http://localhost:3001/book/${BRANCH_ID}`);
  }
}

async function main() {
  const prisma = new PrismaClient();

  console.log('--- Multi-step phone demo setup ---\n');

  await prisma.organization.update({
    where: { id: ORG_ID },
    data: { visitJourneysEnabled: true },
  });
  await prisma.branch.update({
    where: { id: BRANCH_ID },
    data: { defaultJourneyMode: 'visit_multi_step' },
  });
  console.log('✓ Visit journeys enabled; branch default = visit_multi_step');

  const queueIds: Record<string, string> = {};
  for (const spec of QUEUE_SPECS) {
    queueIds[spec.key] = await upsertQueue(prisma, spec);
  }

  const flowSteps = [
    {
      stepIndex: 1,
      deskNumber: '1',
      serviceId: SERVICES.consultation,
      queueId: queueIds.reception,
      stepRole: 'service',
      callingPolicy: 'fifo',
    },
    {
      stepIndex: 2,
      deskNumber: '2',
      serviceId: SERVICES.radiology,
      queueId: queueIds.lab,
      stepRole: 'service',
      callingPolicy: 'fifo',
    },
    {
      stepIndex: 3,
      deskNumber: '3',
      serviceId: SERVICES.pharmacy,
      queueId: queueIds.pharmacy,
      stepRole: 'pickup',
      callingPolicy: 'ready_then_manual',
    },
  ];

  let template = await prisma.branchFlowTemplate.findFirst({
    where: { orgId: ORG_ID, branchId: BRANCH_ID, name: FLOW_NAME },
  });

  if (!template) {
    template = await prisma.branchFlowTemplate.create({
      data: {
        orgId: ORG_ID,
        branchId: BRANCH_ID,
        name: FLOW_NAME,
        isActive: false,
        steps: {
          create: flowSteps.map((step) => ({ orgId: ORG_ID, ...step })),
        },
      },
    });
    console.log(`✓ Created flow: ${FLOW_NAME}`);
  } else {
    await prisma.branchFlowStep.deleteMany({ where: { templateId: template.id } });
    await prisma.branchFlowStep.createMany({
      data: flowSteps.map((step) => ({ orgId: ORG_ID, templateId: template!.id, ...step })),
    });
    console.log(`✓ Updated flow: ${FLOW_NAME}`);
  }

  await prisma.branchFlowTemplate.updateMany({
    where: { orgId: ORG_ID, branchId: BRANCH_ID },
    data: { isActive: false },
  });
  await prisma.branchFlowTemplate.update({
    where: { id: template.id },
    data: { isActive: true },
  });
  await prisma.queue.updateMany({
    where: { orgId: ORG_ID, id: { in: Object.values(queueIds) } },
    data: { flowTemplateId: template.id },
  });
  console.log(`✓ Activated flow (${flowSteps.length} steps)\n`);

  const demoQueueIds = Object.values(queueIds);
  const existingOnDemo = await prisma.ticket.findFirst({
    where: {
      orgId: ORG_ID,
      branchId: BRANCH_ID,
      customerPhone: PHONE_E164,
      queueId: { in: demoQueueIds },
      status: { in: ['waiting', 'called', 'serving'] },
    },
    orderBy: { bookedAt: 'desc' },
    include: { queue: { select: { name: true } } },
  });

  const otherActive = await prisma.ticket.findFirst({
    where: {
      orgId: ORG_ID,
      branchId: BRANCH_ID,
      customerPhone: PHONE_E164,
      queueId: { notIn: demoQueueIds },
      status: { in: ['waiting', 'called', 'serving'] },
    },
    orderBy: { bookedAt: 'desc' },
    include: { queue: { select: { name: true } } },
  });

  if (otherActive) {
    console.log(
      `ℹ Older active ticket ${otherActive.displayNumber} (${otherActive.queue.name}) — cancel from Agent if you want only the demo journey.`,
    );
  }

  if (existingOnDemo) {
    console.log(
      `ℹ Demo ticket for ${PHONE_E164}: ${existingOnDemo.displayNumber} (${existingOnDemo.status}) in ${existingOnDemo.queue.name}`,
    );
    if (existingOnDemo.visitId) {
      console.log(`  Track: http://localhost:3001/track/visit/${existingOnDemo.visitId}`);
    }
  } else {
    await issueTicketViaApi(queueIds.reception);
  }

  console.log('\n--- Test the journey ---');
  console.log('1. Agent: /dashboard/agent — select "Phone Demo · Reception", call & complete.');
  console.log('2. Step 2 auto-issues in "Phone Demo · Lab"; repeat.');
  console.log('3. Step 3 in "Phone Demo · Pharmacy Pickup" — Mark Ready, then call.');
  console.log(`4. Kiosk: http://localhost:3001/book/${BRANCH_ID} — phone +16048618530`);
  console.log(`\nFlows page: activate "${FLOW_NAME}" if you switch templates.`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
