import { PrismaClient } from '@prisma/client';

/**
 * Validates that querying tickets, visits, and appointments by customerPhone
 * executes correctly without Prisma errors.
 *
 * Usage: npx tsx scripts/test-customer-phone-indexes.ts
 */
async function main() {
  console.log('Testing customerPhone indexes on Ticket, Visit, and Appointment...');
  const prisma = new PrismaClient();

  try {
    const orgId = '00000000-0000-0000-0000-000000000000';
    const testPhone = '+15550001234';

    console.log('[1/3] Querying Ticket by customerPhone...');
    const ticketResult = await prisma.ticket.findFirst({
      where: { orgId, customerPhone: testPhone },
    });
    console.log(`  ✓ Ticket query successful (Found: ${!!ticketResult})`);

    console.log('[2/3] Querying Visit by customerPhone...');
    const visitResult = await prisma.visit.findFirst({
      where: { orgId, customerPhone: testPhone },
    });
    console.log(`  ✓ Visit query successful (Found: ${!!visitResult})`);

    console.log('[3/3] Querying Appointment by customerPhone...');
    const apptResult = await prisma.appointment.findFirst({
      where: { orgId, customerPhone: testPhone },
    });
    console.log(`  ✓ Appointment query successful (Found: ${!!apptResult})`);

    console.log('\n🎉 ALL CUSTOMER PHONE INDEX QUERIES EXECUTED SUCCESSFULLY!');
  } catch (err) {
    console.error('\n❌ TEST FAILED');
    console.error(err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
