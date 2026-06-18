import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: 'parsasamandizadeh@gmail.com' },
  });
  console.log('User by email:', user);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
