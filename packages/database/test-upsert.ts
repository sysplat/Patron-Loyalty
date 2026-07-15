import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  console.log(
    await prisma.loyaltyAccount
      .upsert({
        where: { customerId: '99b2585b-8cd7-4a41-8785-79513896cc92' },
        update: {},
        create: {
          orgId: '7032029f-1a88-4b71-8693-6cebefb2b5f1',
          customerId: '99b2585b-8cd7-4a41-8785-79513896cc92',
          referralCode: 'test',
        },
      })
      .catch((e) => e.message),
  );
}
main();
