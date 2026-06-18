/**
 * Sample multi-step flow for mehdi.shiravi@gmail.com (Sysplat org).
 * Run: pnpm --filter @queueplatform/database exec tsx scripts/setup-mehdi-clinic-demo.ts
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';

config({ path: resolve(__dirname, '../../../.env') });

const USER_EMAIL = 'mehdi.shiravi@gmail.com';
const FLOW_NAME = 'Clinic Visit Journey (Sample)';
const BRANCH_NAME = 'Main Branch';

const SERVICES = {
  registration: 'demo-registration',
  consultation: 'demo-consultation',
  pharmacy: 'demo-pharmacy',
} as const;

const SERVICE_SPECS = [
  {
    key: 'registration' as const,
    name: 'Patient Registration',
    slug: SERVICES.registration,
    description: 'Front desk check-in and intake',
    durationMinutes: 10,
  },
  {
    key: 'consultation' as const,
    name: 'Doctor Consultation',
    slug: SERVICES.consultation,
    description: 'Consultation with the physician',
    durationMinutes: 20,
  },
  {
    key: 'pharmacy' as const,
    name: 'Pharmacy Pick-up',
    slug: SERVICES.pharmacy,
    description: 'Collect prescriptions when ready',
    durationMinutes: 5,
  },
];

const QUEUE_SPECS = [
  {
    key: 'reception',
    name: 'Sample · Reception',
    prefix: 'R',
    serviceKey: 'registration' as const,
    stepRole: 'service' as const,
    callingPolicy: 'fifo' as const,
  },
  {
    key: 'consultation',
    name: 'Sample · Consultation',
    prefix: 'C',
    serviceKey: 'consultation' as const,
    stepRole: 'service' as const,
    callingPolicy: 'fifo' as const,
  },
  {
    key: 'pharmacy',
    name: 'Sample · Pharmacy Pick-up',
    prefix: 'P',
    serviceKey: 'pharmacy' as const,
    stepRole: 'pickup' as const,
    callingPolicy: 'ready_then_manual' as const,
  },
];

async function upsertService(
  prisma: PrismaClient,
  orgId: string,
  branchId: string,
  spec: (typeof SERVICE_SPECS)[number],
): Promise<string> {
  const existing = await prisma.service.findFirst({
    where: { orgId, slug: spec.slug },
  });

  const data = {
    name: spec.name,
    description: spec.description,
    durationMinutes: spec.durationMinutes,
    queueEnabled: true,
    appointmentEnabled: false,
    serviceEstimateLowMinutes: 5,
    serviceEstimateHighMinutes: 15,
    status: 'active' as const,
  };

  const service = existing
    ? await prisma.service.update({ where: { id: existing.id }, data })
    : await prisma.service.create({
        data: { orgId, slug: spec.slug, ...data },
      });

  await prisma.branchService.upsert({
    where: { branchId_serviceId: { branchId, serviceId: service.id } },
    create: { branchId, serviceId: service.id, isActive: true },
    update: { isActive: true },
  });

  console.log(`✓ Service: ${spec.name}`);
  return service.id;
}

async function upsertQueue(
  prisma: PrismaClient,
  orgId: string,
  branchId: string,
  serviceId: string,
  spec: (typeof QUEUE_SPECS)[number],
): Promise<string> {
  const existing = await prisma.queue.findFirst({
    where: { orgId, branchId, name: spec.name },
  });

  const data = {
    serviceId,
    name: spec.name,
    prefix: spec.prefix,
    journeyModeOverride: 'visit_multi_step',
    stepRole: spec.stepRole,
    callingPolicy: spec.callingPolicy,
    status: 'open',
    minServiceMinutes: 5,
    maxServiceMinutes: 20,
  };

  const queue = existing
    ? await prisma.queue.update({ where: { id: existing.id }, data })
    : await prisma.queue.create({ data: { orgId, branchId, ...data } });

  console.log(`✓ Queue: ${spec.name} (${spec.prefix})`);
  return queue.id;
}

async function main() {
  const prisma = new PrismaClient();

  const user = await prisma.user.findFirst({
    where: { email: { equals: USER_EMAIL, mode: 'insensitive' } },
    select: { id: true, email: true, orgId: true, firstName: true, lastName: true },
  });
  if (!user) {
    throw new Error(`User not found: ${USER_EMAIL}`);
  }

  const branch = await prisma.branch.findFirst({
    where: { orgId: user.orgId, name: BRANCH_NAME },
    select: { id: true, name: true },
  });
  if (!branch) {
    throw new Error(`Branch "${BRANCH_NAME}" not found for org ${user.orgId}`);
  }

  const orgId = user.orgId;
  const branchId = branch.id;

  console.log(`--- Sample flow setup for ${user.firstName} ${user.lastName} <${user.email}> ---\n`);
  console.log(`Organization: ${orgId}`);
  console.log(`Branch: ${branch.name} (${branchId})\n`);

  await prisma.organization.update({
    where: { id: orgId },
    data: { visitJourneysEnabled: true },
  });
  await prisma.branch.update({
    where: { id: branchId },
    data: { defaultJourneyMode: 'visit_multi_step' },
  });
  console.log('✓ Enabled visit journeys for organization and branch\n');

  const serviceIds: Record<keyof typeof SERVICES, string> = {} as Record<
    keyof typeof SERVICES,
    string
  >;
  for (const spec of SERVICE_SPECS) {
    serviceIds[spec.key] = await upsertService(prisma, orgId, branchId, spec);
  }

  const queueIds: Record<string, string> = {};
  for (const spec of QUEUE_SPECS) {
    queueIds[spec.key] = await upsertQueue(
      prisma,
      orgId,
      branchId,
      serviceIds[spec.serviceKey],
      spec,
    );
  }

  const flowSteps = [
    {
      stepIndex: 1,
      deskNumber: '1',
      serviceId: serviceIds.registration,
      queueId: queueIds.reception,
      stepRole: 'service',
      callingPolicy: 'fifo',
    },
    {
      stepIndex: 2,
      deskNumber: '2',
      serviceId: serviceIds.consultation,
      queueId: queueIds.consultation,
      stepRole: 'service',
      callingPolicy: 'fifo',
    },
    {
      stepIndex: 3,
      deskNumber: '3',
      serviceId: serviceIds.pharmacy,
      queueId: queueIds.pharmacy,
      stepRole: 'pickup',
      callingPolicy: 'ready_then_manual',
    },
  ];

  await prisma.branchFlowTemplate.updateMany({
    where: { orgId, branchId },
    data: { isActive: false },
  });

  let template = await prisma.branchFlowTemplate.findFirst({
    where: { orgId, branchId, name: FLOW_NAME },
  });

  if (!template) {
    template = await prisma.branchFlowTemplate.create({
      data: {
        orgId,
        branchId,
        name: FLOW_NAME,
        description:
          'Sample 3-step clinic journey for testing kiosk, agent console, and flow editor.',
        isActive: true,
        steps: {
          create: flowSteps.map((step) => ({ orgId, ...step })),
        },
      },
    });
    console.log(`\n✓ Created and activated flow: ${FLOW_NAME}`);
  } else {
    await prisma.branchFlowStep.deleteMany({ where: { templateId: template.id } });
    await prisma.branchFlowStep.createMany({
      data: flowSteps.map((step) => ({ orgId, templateId: template!.id, ...step })),
    });
    await prisma.branchFlowTemplate.update({
      where: { id: template.id },
      data: {
        isActive: true,
        description:
          'Sample 3-step clinic journey for testing kiosk, agent console, and flow editor.',
      },
    });
    console.log(`\n✓ Updated and activated flow: ${FLOW_NAME}`);
  }

  await prisma.queue.updateMany({
    where: { orgId, branchId },
    data: { flowTemplateId: null },
  });
  await prisma.queue.updateMany({
    where: { orgId, id: { in: Object.values(queueIds) } },
    data: { flowTemplateId: template.id },
  });

  for (const step of flowSteps) {
    await prisma.queue.update({
      where: { id: step.queueId },
      data: {
        stepRole: step.stepRole,
        callingPolicy: step.callingPolicy,
        journeyModeOverride: 'visit_multi_step',
      },
    });
  }

  const webBase = process.env.NEXT_PUBLIC_WEB_URL?.replace(/\/$/, '') ?? 'http://localhost:3001';
  const kioskUrl = `${webBase}/kiosk/${branchId}`;

  console.log('\n--- How to test ---');
  console.log('1. Organization → enable “Visit journeys” if not already on (script enabled it).');
  console.log(
    '2. Flows → select Main Branch → you should see “Clinic Visit Journey (Sample)” active.',
  );
  console.log('3. Kiosk (customers only see Reception):');
  console.log(`   ${kioskUrl}`);
  console.log(
    '4. Agent console → Main Branch → “Sample · Reception” → call & complete → auto-advances to Consultation, then Pharmacy.',
  );
  console.log('5. Pharmacy step: Mark Ready before calling (pick-up policy).\n');
  console.log('Steps:');
  flowSteps.forEach((s, i) => {
    const q = QUEUE_SPECS[i];
    console.log(
      `   ${s.stepIndex}. ${q.name} → ${SERVICE_SPECS.find((x) => x.key === q.serviceKey)?.name}`,
    );
  });

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
