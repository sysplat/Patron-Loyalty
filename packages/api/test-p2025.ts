import { PrismaClient } from '@prisma/client';
async function main() {
  const prisma = new PrismaClient();
  const orgId = 'b7987bf3-692f-408b-a868-ce1a145bb60e';
  const customerId = 'e9838cbb-fbad-4c5f-8fb1-2c92a4448ab8';

  try {
    let account = await prisma.loyaltyAccount.findUnique({
      where: { customerId },
    });
    console.log('Account is', account?.id);

    await prisma.loyaltyPointLedger.create({
      data: {
        orgId,
        accountId: account!.id,
        type: 'EARN',
        points: 10,
        balanceAfter: 10,
        sourceType: 'ticket',
        sourceId: '9b8c9dd4-5b76-4d44-99cc-e77a08bae9e3',
        description: 'Points for completed visit',
      },
    });
    console.log('Ledger created');
  } catch (e: any) {
    console.log('ERROR IS', e.code, e.meta);
  }
}
main().finally(() => process.exit(0));
