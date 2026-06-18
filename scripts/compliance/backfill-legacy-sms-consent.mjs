import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const orgArg = process.argv.find((arg) => arg.startsWith('--org='));
const orgId = orgArg ? orgArg.split('=')[1] : null;
const batchSize = 500;

async function main() {
  console.log(
    `[legacy-sms-consent] mode=${apply ? 'APPLY' : 'DRY_RUN'}${orgId ? ` org=${orgId}` : ''}`,
  );

  let cursor = null;
  let scannedCustomers = 0;
  let customersWithoutEvidence = 0;
  let updatedCustomers = 0;
  let updatedTickets = 0;
  let insertedAuditRows = 0;

  while (true) {
    const where = {
      transactionalSmsAllowed: true,
      phone: { not: null },
      ...(orgId ? { orgId } : {}),
    };

    const customers = await prisma.customer.findMany({
      where,
      orderBy: { id: 'asc' },
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: { id: true, orgId: true },
    });

    if (customers.length === 0) break;
    cursor = customers[customers.length - 1].id;
    scannedCustomers += customers.length;

    const customerIds = customers.map((customer) => customer.id);
    const consentRows = await prisma.activityLog.findMany({
      where: {
        orgId: { in: [...new Set(customers.map((customer) => customer.orgId))] },
        resourceType: 'customer_consent',
        action: { in: ['consent.sms.captured', 'consent.sms.updated'] },
        resourceId: { in: customerIds },
      },
      select: { resourceId: true },
    });

    const consentCustomerIds = new Set(
      consentRows.map((row) => row.resourceId).filter((value) => typeof value === 'string'),
    );
    const missingEvidenceCustomers = customers.filter(
      (customer) => !consentCustomerIds.has(customer.id),
    );
    if (missingEvidenceCustomers.length === 0) continue;

    customersWithoutEvidence += missingEvidenceCustomers.length;
    if (!apply) continue;

    const missingIds = missingEvidenceCustomers.map((customer) => customer.id);
    const orgIds = [...new Set(missingEvidenceCustomers.map((customer) => customer.orgId))];

    const customerUpdate = await prisma.customer.updateMany({
      where: { id: { in: missingIds }, orgId: { in: orgIds } },
      data: { transactionalSmsAllowed: false },
    });
    updatedCustomers += customerUpdate.count;

    const ticketUpdate = await prisma.ticket.updateMany({
      where: {
        orgId: { in: orgIds },
        customerId: { in: missingIds },
        status: { in: ['waiting', 'called', 'serving'] },
      },
      data: { transactionalSmsAllowed: false },
    });
    updatedTickets += ticketUpdate.count;

    const createdAt = new Date();
    const activityLogs = missingEvidenceCustomers.map((customer) => ({
      orgId: customer.orgId,
      action: 'consent.sms.backfilled_false',
      resourceType: 'customer_consent',
      resourceId: customer.id,
      metadata: {
        reason: 'legacy_true_without_explicit_evidence',
        script: 'compliance/backfill-legacy-sms-consent.mjs',
        appliedAt: createdAt.toISOString(),
      },
      createdAt,
    }));
    const logInsert = await prisma.activityLog.createMany({
      data: activityLogs,
    });
    insertedAuditRows += logInsert.count;
  }

  console.log('[legacy-sms-consent] completed');
  console.log(
    JSON.stringify(
      {
        mode: apply ? 'APPLY' : 'DRY_RUN',
        orgId,
        scannedCustomers,
        customersWithoutEvidence,
        updatedCustomers,
        updatedTickets,
        insertedAuditRows,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error('[legacy-sms-consent] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

