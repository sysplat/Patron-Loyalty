import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:VQNivofSODMbUDGykbJgOdXJdKNTQKUd@nozomi.proxy.rlwy.net:32755/railway',
    },
  },
});

async function run() {
  const account = await prisma.loyaltyAccount.findMany({
    where: {
      customer: {
        phone: '+15551234567',
      },
    },
  });
  console.log('Loyalty accounts for +15551234567:', account);
}
run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
