const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testComprehensive() {
  const orgId = 'cf711601-8dcc-4e13-802e-8ab28d297c7a';
  const branchId = '6b7e25db-0d16-47a0-adea-0dd94e5a3e2b';
  const serviceId = 'd167f87d-1174-492a-a5f5-8963d03206f7';
  const queueId = '91a40754-55ef-4243-a4bf-73904be0a1f7';

  console.log('--- Step 1: Checking Journey Mode Configuration ---');
  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  console.log(`Branch Default Journey Mode: ${branch?.defaultJourneyMode}`);
  console.log(`Service Journey Mode Override: ${service?.journeyModeOverride}`);

  console.log('\n--- Step 2: Simulating Ticket Issuance (Start Visit) ---');
  const journeyMode = service?.journeyModeOverride || branch?.defaultJourneyMode || 'single_ticket';
  console.log(`Resolved Journey Mode: ${journeyMode}`);

  let visitId = null;
  if (journeyMode === 'visit_multi_step') {
    const visit = await prisma.visit.create({
      data: {
        orgId,
        branchId,
        source: 'test',
        customerName: 'Comprehensive Test',
        status: 'active',
      },
    });
    visitId = visit.id;
    console.log(`Visit created: ${visitId}`);
  }

  const ticket = await prisma.ticket.create({
    data: {
      orgId,
      branchId,
      serviceId,
      queueId,
      visitId,
      displayNumber: 'T-100',
      status: 'waiting',
      source: 'test',
    },
  });
  console.log(`Ticket created: ${ticket.displayNumber} (ID: ${ticket.id})`);

  console.log('\n--- Step 3: Verifying Public Tracking Logic ---');
  const visitRecord = await prisma.visit.findUnique({
    where: { id: visitId },
    include: {
      tickets: {
        include: {
          queue: true,
          service: true,
        },
        orderBy: { bookedAt: 'asc' },
      },
      branch: true,
    },
  });

  if (!visitRecord) throw new Error('Visit not found in DB');

  const activeTicket =
    visitRecord.tickets.find((t) => ['waiting', 'called', 'serving'].includes(t.status)) ||
    visitRecord.tickets[visitRecord.tickets.length - 1];
  console.log(`Visit Status: ${visitRecord.status}`);
  console.log(`Active Ticket: ${activeTicket?.displayNumber}`);
  console.log(`Total tickets in journey: ${visitRecord.tickets.length}`);

  console.log('\n--- Step 4: Adding a Step ---');
  const secondTicket = await prisma.ticket.create({
    data: {
      orgId,
      branchId,
      serviceId,
      queueId,
      visitId,
      displayNumber: 'T-101',
      status: 'waiting',
      source: 'test',
    },
  });
  console.log(`Second ticket added to visit: ${secondTicket.displayNumber}`);

  console.log('\n--- Step 5: Completing Journey ---');
  await prisma.ticket.updateMany({
    where: { visitId: visitId },
    data: { status: 'completed', completedAt: new Date() },
  });

  const activeCount = await prisma.ticket.count({
    where: {
      visitId: visitId,
      status: { in: ['waiting', 'called', 'serving'] },
    },
  });

  if (activeCount === 0) {
    await prisma.visit.update({
      where: { id: visitId },
      data: { status: 'completed', completedAt: new Date() },
    });
    console.log('Visit status updated to COMPLETED');
  }

  console.log('\n--- TEST SUCCESSFUL ---');

  await prisma.ticket.deleteMany({ where: { visitId: visitId } });
  await prisma.visit.delete({ where: { id: visitId } });
  console.log('Test data cleaned up.');
}

testComprehensive()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
