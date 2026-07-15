import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres:VQNivofSODMbUDGykbJgOdXJdKNTQKUd@nozomi.proxy.rlwy.net:32755/railway',
      },
    },
  });

  // QlessQ has settings table.
  const settings = await prisma.setting.findMany();
  console.log(
    'Settings in QlessQ:',
    settings.map((s) => ({ key: s.key, value: s.value })),
  );

  await prisma.$disconnect();
}

main().catch(console.error);
