import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const orgId = 'b7987bf3-692f-408b-a868-ce1a145bb60e';

  try {
    const res = await prisma.customer.findMany({
      where: { orgId },
    });
    console.log('TOTAL CUSTOMERS', res.length);
  } catch (e: any) {
    console.error('ERROR IS', e.code, e.message);
  }
}
main().finally(() => process.exit(0));
