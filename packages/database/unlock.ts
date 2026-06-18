import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.user.updateMany({
    where: { email: 'parsasamandizadeh@gmail.com' },
    data: {
      adminTwoFactorEnabled: false,
      adminTwoFactorSecret: null,
      adminTwoFactorBackupHashes: null,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupHashes: null,
    },
  });
  console.log('Disabled all 2FA for parsasamandizadeh@gmail.com');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
