import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'mehdi.shiravi@gmail.com';
  const user = await prisma.user.findFirst({
    where: { email },
  });

  if (!user) {
    console.log(`User with email ${email} not found.`);
    return;
  }

  console.log(`Found user: ${user.id} (${user.email}) in Org: ${user.orgId}. Deleting...`);

  try {
    await prisma.user.delete({
      where: { id: user.id },
    });
    console.log('User deleted successfully.');
  } catch (error) {
    console.error('Error deleting user:', error);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
