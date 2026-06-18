import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Searching for ticket C014 ---');

  // Find the ticket by its display number
  const tickets = await prisma.ticket.findMany({
    where: {
      displayNumber: {
        contains: 'C014',
      },
    },
    include: {
      queue: {
        select: {
          id: true,
          name: true,
          branchId: true,
          callingPolicy: true,
          status: true,
          stepRole: true,
        },
      },
      visit: {
        select: {
          id: true,
          status: true,
          branchId: true,
        },
      },
    },
  });

  console.log('Found tickets:', JSON.stringify(tickets, null, 2));

  // Also let's print all active queues and their branches to see how the system is currently structured
  const queues = await prisma.queue.findMany({
    include: {
      branch: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
  console.log('\n--- Active Queues in System ---');
  console.log(
    JSON.stringify(
      queues.map((q) => ({
        id: q.id,
        name: q.name,
        branchName: q.branch?.name,
        branchId: q.branchId,
        status: q.status,
        stepRole: q.stepRole,
      })),
      null,
      2,
    ),
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
