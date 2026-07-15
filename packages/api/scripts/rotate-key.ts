import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';

async function main() {
  const prisma = new PrismaClient();
  const orgId = 'b7987bf3-692f-408b-a868-ce1a145bb60e';

  const raw = `lms_${randomBytes(32).toString('hex')}`;
  const prefix = raw.slice(0, 12);
  const hash = createHash('sha256').update(raw).digest('hex');
  const createdAt = new Date().toISOString();

  const payload = { hash, prefix, createdAt };

  // bypass RLS is just normal prisma query since we are a superuser scripts

  const existing = await prisma.setting.findFirst({
    where: { orgId, key: 'loyalty.integration.apiKey', scope: 'org', scopeId: null },
  });

  if (existing) {
    await prisma.setting.update({
      where: { id: existing.id },
      data: { value: payload },
    });
  } else {
    await prisma.setting.create({
      data: {
        orgId,
        key: 'loyalty.integration.apiKey',
        value: payload,
        scope: 'org',
      },
    });
  }

  console.log(`NEW API KEY: ${raw}`);
  await prisma.$disconnect();
}

main().catch(console.error);
