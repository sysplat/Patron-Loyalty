import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'mehdi.shiravi@gmail.com';
  const user = await prisma.user.findFirst({
    where: { email },
    include: {
      account: true,
      roleAssignments: {
        include: {
          role: true,
          branch: true,
        },
      },
      organization: true,
    },
  });

  if (!user) {
    console.log(`User ${email} not found.`);
  } else {
    console.log(JSON.stringify(user, null, 2));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
