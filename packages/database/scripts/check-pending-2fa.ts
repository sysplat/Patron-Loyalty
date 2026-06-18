import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      adminTwoFactorSecret: { not: null },
      adminTwoFactorEnabled: false,
    },
    select: {
      id: true,
      email: true,
      adminTwoFactorEnabled: true,
      adminTwoFactorSecret: true,
    },
  });
  console.log('PENDING 2FA USERS:', JSON.stringify(users, null, 2));

  const nullEmailUsers = await prisma.user.findMany({
    where: {
      email: null,
    },
    select: {
      id: true,
      email: true,
      phone: true,
    },
  });
  console.log('NULL EMAIL USERS:', JSON.stringify(nullEmailUsers, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
