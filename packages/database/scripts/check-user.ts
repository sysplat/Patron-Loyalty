import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      adminTwoFactorEnabled: true,
      adminTwoFactorSecret: true,
      orgId: true,
      organization: {
        select: {
          slug: true,
        },
      },
    },
  });
  console.log('USERS:', JSON.stringify(users, null, 2));
}

main()
  .catch((e) => {
    console.error('ERROR RUNNING SCRATCH:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
