import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { TicketService } from '../src/modules/ticket/ticket.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const ticketService = app.get(TicketService);
  const prisma = app.get(PrismaService);

  const orgId = 'cf711601-8dcc-4e13-802e-8ab28d297c7a';
  const phone = '6048618530';

  console.log('--- STARTING STANDALONE FLOW TEST ---');

  // 1. Get IDs
  const branch = await prisma.branch.findFirst({ where: { orgId, name: 'City Medical Center' } });
  const srvConsultation = await prisma.service.findFirst({
    where: { orgId, name: 'General Consultation' },
  });
  const qMain = await prisma.queue.findFirst({
    where: { orgId, branchId: branch?.id, name: 'Main Waiting Lounge' },
  });
  const user = await prisma.user.findFirst({ where: { email: 'parsasamandizadeh@gmail.com' } });

  if (!branch || !srvConsultation || !qMain || !user) {
    console.error('Missing initial data');
    await app.close();
    return;
  }

  // 2. Issue Ticket
  console.log('Issuing ticket for Step 1...');
  const ticket = await ticketService.issueTicket(
    orgId,
    {
      branchId: branch.id,
      queueId: qMain.id,
      serviceId: srvConsultation.id,
      customerPhone: phone,
      customerName: 'Test User',
      source: 'kiosk',
    },
    'system',
  );

  console.log(`Ticket Issued: ${ticket.displayNumber} (ID: ${ticket.id})`);

  // 3. Call Ticket
  console.log('Calling ticket...');
  await ticketService.callSpecific(orgId, ticket.id, '1', user.id); // Desk 1

  // 4. Complete Ticket
  console.log('Completing ticket (Step 1)...');
  await ticketService.complete(orgId, ticket.id, user.id);

  // 5. Verify Step 2
  console.log('Verifying Step 2 issue...');
  await new Promise((r) => setTimeout(r, 1000));

  const nextTicket = await prisma.ticket.findFirst({
    where: { visitId: ticket.visitId, stepIndex: 2 },
    include: { queue: true },
  });

  if (nextTicket) {
    console.log(`✅ SUCCESS: Ticket for Step 2 issued!`);
    console.log(`   New Ticket: ${nextTicket.displayNumber}`);
    console.log(`   Queue: ${nextTicket.queue.name}`);
  } else {
    console.error('❌ FAILURE: Next ticket not found.');
  }

  await app.close();
}

main().catch(console.error);
