const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const desks = await prisma.desk.findMany({
    include: { branch: true },
  });
  console.log(JSON.stringify(desks, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
