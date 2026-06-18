import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Querying ticket details ---');
  const tickets = await prisma.ticket.findMany({
    where: {
      displayNumber: {
        contains: 'C014',
      },
    },
    include: {
      queue: true,
      visit: true,
    },
  });

  if (tickets.length === 0) {
    console.log('No ticket matching C014 found in database!');
    return;
  }

  for (const t of tickets) {
    console.log(`Ticket ID: ${t.id}`);
    console.log(`Display Number: ${t.displayNumber}`);
    console.log(`Status: ${t.status}`);
    console.log(`Queue ID: ${t.queueId} (${t.queue?.name})`);
    console.log(`Queue Status: ${t.queue?.status}`);
    console.log(`Branch ID: ${t.queue?.branchId}`);
    console.log(`Visit ID: ${t.visitId}`);
    console.log(`Visit Status: ${t.visit?.status}`);
    console.log(`Visit Branch ID: ${t.visit?.branchId}`);
    console.log(`Booked At: ${t.bookedAt}`);
    console.log(`Called At: ${t.calledAt}`);
    console.log(`Ready At: ${t.readyAt}`);
    console.log(`Served At: ${t.servedAt}`);
    console.log(`Completed At: ${t.completedAt}`);
    console.log('---------------------------------');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
