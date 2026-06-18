import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const email = 'parsasamandizadeh@gmail.com';
  console.log('Finding user...', email);

  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) throw new Error('User not found');

  const org = await prisma.organization.findUnique({
    where: { id: user.orgId },
    include: { branches: true, services: true },
  });
  if (!org || org.branches.length === 0) throw new Error('No branches found');

  const branch = org.branches[0];
  const service = org.services[0];

  console.log(`Setting up in branch: ${branch.name}`);

  // 1. Create Queues
  const gEntry = await prisma.queue.create({
    data: {
      orgId: org.id,
      branchId: branch.id,
      serviceId: service.id,
      name: 'General Entry Test',
      prefix: 'GT1',
      journeyModeOverride: 'visit_multi_step',
      isActive: true,
    },
  });
  const gService = await prisma.queue.create({
    data: {
      orgId: org.id,
      branchId: branch.id,
      serviceId: service.id,
      name: 'General Service Test',
      prefix: 'GT2',
      isActive: true,
    },
  });

  const eEntry = await prisma.queue.create({
    data: {
      orgId: org.id,
      branchId: branch.id,
      serviceId: service.id,
      name: 'Express Entry Test',
      prefix: 'ET1',
      journeyModeOverride: 'visit_multi_step',
      isActive: true,
    },
  });
  const eService = await prisma.queue.create({
    data: {
      orgId: org.id,
      branchId: branch.id,
      serviceId: service.id,
      name: 'Express Service Test',
      prefix: 'ET2',
      isActive: true,
    },
  });

  console.log('Created queues.');

  // 2. Create Templates
  const gTemplate = await prisma.branchFlowTemplate.create({
    data: {
      orgId: org.id,
      branchId: branch.id,
      name: 'General Flow Test',
      description: 'Test',
      createdByUserId: user.id,
      status: 'published',
      activeAt: new Date(),
      steps: {
        create: [
          {
            orgId: org.id,
            branchId: branch.id,
            serviceId: service.id,
            queueId: gEntry.id,
            order: 1,
            stepRole: 'service',
            callingPolicy: 'fifo',
          },
          {
            orgId: org.id,
            branchId: branch.id,
            serviceId: service.id,
            queueId: gService.id,
            order: 2,
            stepRole: 'service',
            callingPolicy: 'fifo',
          },
        ],
      },
    },
  });

  const eTemplate = await prisma.branchFlowTemplate.create({
    data: {
      orgId: org.id,
      branchId: branch.id,
      name: 'Express Flow Test',
      description: 'Test',
      createdByUserId: user.id,
      status: 'published',
      activeAt: new Date(),
      steps: {
        create: [
          {
            orgId: org.id,
            branchId: branch.id,
            serviceId: service.id,
            queueId: eEntry.id,
            order: 1,
            stepRole: 'service',
            callingPolicy: 'fifo',
          },
          {
            orgId: org.id,
            branchId: branch.id,
            serviceId: service.id,
            queueId: eService.id,
            order: 2,
            stepRole: 'service',
            callingPolicy: 'fifo',
          },
        ],
      },
    },
  });

  await prisma.queue.update({ where: { id: gEntry.id }, data: { flowTemplateId: gTemplate.id } });
  await prisma.queue.update({ where: { id: eEntry.id }, data: { flowTemplateId: eTemplate.id } });

  console.log('Templates published and activated.');

  // 3. Issue tickets
  const visit1 = await prisma.visit.create({ data: { orgId: org.id, branchId: branch.id } });
  const ticket1 = await prisma.ticket.create({
    data: {
      orgId: org.id,
      branchId: branch.id,
      queueId: gEntry.id,
      serviceId: service.id,
      visitId: visit1.id,
      ticketNumber: 9001,
      displayNumber: 'GT1-9001',
      status: 'waiting',
      flowTemplateId: gTemplate.id,
      stepIndex: 0,
    },
  });

  const visit2 = await prisma.visit.create({ data: { orgId: org.id, branchId: branch.id } });
  const ticket2 = await prisma.ticket.create({
    data: {
      orgId: org.id,
      branchId: branch.id,
      queueId: eEntry.id,
      serviceId: service.id,
      visitId: visit2.id,
      ticketNumber: 9002,
      displayNumber: 'ET1-9002',
      status: 'waiting',
      flowTemplateId: eTemplate.id,
      stepIndex: 0,
    },
  });

  console.log(
    `Issued ticket ${ticket1.displayNumber} into General Flow and ${ticket2.displayNumber} into Express Flow.`,
  );
  console.log(
    'Setup complete! You can now log in and go to the Kiosk or Staff Console to see both active parallel templates and the tickets waiting.',
  );
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
