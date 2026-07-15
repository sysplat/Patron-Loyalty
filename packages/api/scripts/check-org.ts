import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const org = await prisma.organization.findUnique({
    where: { id: 'b7987bf3-692f-408b-a868-ce1a145bb60e' },
  });
  console.log('Org in PL DB:', org);
  await prisma.$disconnect();
}

main().catch(console.error);
