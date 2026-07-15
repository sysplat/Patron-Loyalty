import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const orgs = await prisma.organization.findMany();
  console.log(
    'Orgs in PL DB:',
    orgs.map((o) => ({ id: o.id, name: o.name })),
  );

  const settings = await prisma.setting.findMany({
    where: { key: 'loyalty.integration.apiKey' },
  });
  console.log(
    'API Keys configured for:',
    settings.map((s) => s.orgId),
  );

  await prisma.$disconnect();
}

main().catch(console.error);
