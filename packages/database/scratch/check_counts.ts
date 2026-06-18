import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const serviceCount = await prisma.service.count();
  const ticketCount = await prisma.ticket.count();
  const branchServiceCount = await prisma.branchService.count();

  console.log({
    serviceCount,
    ticketCount,
    branchServiceCount,
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
