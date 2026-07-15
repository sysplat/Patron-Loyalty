import { PrismaClient } from '@prisma/client';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres:VQNivofSODMbUDGykbJgOdXJdKNTQKUd@nozomi.proxy.rlwy.net:32755/railway',
      },
    },
  });
  console.log('Connected to QlessQ DB via Prisma');

  const customers = await prisma.customer.findMany({
    where: { orgId: 'b7987bf3-692f-408b-a868-ce1a145bb60e' },
    select: { id: true, name: true, email: true, phone: true },
  });

  console.log(`Found ${customers.length} customers to sync.`);

  const API_KEY = 'lms_a5a82fc32cd00308b8d408931a5ff02fc5cc840e0bc04dbc263b3023876dde6c';
  const URL = 'http://localhost:4000/api/v1/loyalty/integrations/v1/queue-events';

  let successCount = 0;
  let failCount = 0;

  for (const row of customers) {
    const payload = {
      event: 'customer.created',
      sourceId: row.id,
      occurredAt: new Date().toISOString(),
      customer: {
        externalId: row.id,
        name: row.name,
        email: row.email || undefined,
        phone: row.phone || undefined,
      },
    };

    try {
      const resp = await fetch(URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Loyalty-Api-Key': API_KEY,
        },
        body: JSON.stringify(payload),
      });

      const data = (await resp.json()) as any;
      if (resp.ok && data.success) {
        successCount++;
      } else {
        console.error(`Failed to sync ${row.id}:`, data);
        failCount++;
      }
    } catch (e: any) {
      console.error(`Error syncing ${row.id}:`, e.message);
      failCount++;
    }

    await delay(100);
  }

  console.log(`Sync complete. Success: ${successCount}, Failed: ${failCount}`);
  await prisma.$disconnect();
}

main().catch(console.error);
