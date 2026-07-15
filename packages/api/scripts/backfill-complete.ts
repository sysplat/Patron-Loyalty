import { PrismaClient } from '@prisma/client';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Configuration ──────────────────────────────────────────────────────
const QLESSQ_DB_URL =
  'postgresql://postgres:VQNivofSODMbUDGykbJgOdXJdKNTQKUd@nozomi.proxy.rlwy.net:32755/railway';
const PL_API_URL =
  'https://pl-api-production-a528.up.railway.app/api/v1/loyalty/integrations/v1/queue-events';
const API_KEY = 'lms_a5a82fc32cd00308b8d408931a5ff02fc5cc840e0bc04dbc263b3023876dde6c';
const ORG_ID = 'b7987bf3-692f-408b-a868-ce1a145bb60e';

// Rate limit: 20 req/sec (short) and 100 req/min (medium)
const BASE_DELAY_MS = 800;
const MAX_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 3000;

// ─── Types ──────────────────────────────────────────────────────────────
interface SyncStats {
  attempted: number;
  success: number;
  skipped: number;
  failed: number;
  errors: string[];
}

// ─── Helpers ────────────────────────────────────────────────────────────
async function sendEvent(
  payload: Record<string, unknown>,
  stats: SyncStats,
  label: string,
): Promise<boolean> {
  stats.attempted++;

  for (let retry = 0; retry < MAX_RETRIES; retry++) {
    try {
      const resp = await fetch(PL_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Loyalty-Api-Key': API_KEY,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });

      if (resp.status === 429) {
        const backoff = RETRY_BASE_DELAY_MS * Math.pow(2, retry);
        console.log(
          `  ⏳ Rate limited on ${label}, waiting ${backoff}ms (retry ${retry + 1}/${MAX_RETRIES})`,
        );
        await delay(backoff);
        continue;
      }

      const data = (await resp.json()) as Record<string, unknown>;

      if (resp.ok) {
        if (data.skipped) {
          stats.skipped++;
          return true;
        }
        stats.success++;
        return true;
      } else {
        const errMsg = `${label}: ${JSON.stringify(data)}`;
        stats.errors.push(errMsg);
        stats.failed++;
        console.error(`  ❌ ${errMsg}`);
        return false;
      }
    } catch (e: any) {
      if (retry < MAX_RETRIES - 1) {
        const backoff = RETRY_BASE_DELAY_MS * Math.pow(2, retry);
        console.log(`  ⏳ Network error on ${label}: ${e.message}, retrying in ${backoff}ms`);
        await delay(backoff);
        continue;
      }
      const errMsg = `${label}: ${e.message}`;
      stats.errors.push(errMsg);
      stats.failed++;
      console.error(`  ❌ ${errMsg}`);
      return false;
    }
  }

  stats.failed++;
  return false;
}

function printStats(phase: string, stats: SyncStats) {
  console.log(`\n📊 ${phase} Results:`);
  console.log(`   Attempted: ${stats.attempted}`);
  console.log(`   ✅ Success: ${stats.success}`);
  console.log(`   ⏭️  Skipped: ${stats.skipped}`);
  console.log(`   ❌ Failed:  ${stats.failed}`);
  if (stats.errors.length > 0) {
    console.log(`   First 5 errors:`);
    stats.errors.slice(0, 5).forEach((e) => console.log(`     - ${e}`));
  }
}

function newStats(): SyncStats {
  return { attempted: 0, success: 0, skipped: 0, failed: 0, errors: [] };
}

// ─── Main ───────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   QlessQ → Patron Loyalty: Complete Data Sync              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`\nTarget org: ${ORG_ID}`);
  console.log(`PL API: ${PL_API_URL}\n`);

  const prisma = new PrismaClient({
    datasources: { db: { url: QLESSQ_DB_URL } },
  });

  try {
    // ═══════════════════════════════════════════════════════════════════
    // PHASE 1: Sync all customers (customer.created)
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n━━━ PHASE 1: Syncing Customers ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const customers = await prisma.customer.findMany({
      where: { orgId: ORG_ID },
      select: { id: true, name: true, email: true, phone: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    console.log(`Found ${customers.length} customers to sync.\n`);

    const customerStats = newStats();
    for (let i = 0; i < customers.length; i++) {
      const c = customers[i];
      const label = `customer ${i + 1}/${customers.length} (${c.id})`;

      if (i > 0 && i % 50 === 0) {
        console.log(
          `  📦 Progress: ${i}/${customers.length} (${customerStats.success} ok, ${customerStats.failed} failed)`,
        );
      }

      await sendEvent(
        {
          event: 'customer.created',
          sourceId: c.id,
          occurredAt: c.createdAt.toISOString(),
          customer: {
            externalId: c.id,
            name: c.name,
            email: c.email || undefined,
            phone: c.phone || undefined,
          },
        },
        customerStats,
        label,
      );

      await delay(BASE_DELAY_MS);
    }
    printStats('PHASE 1: Customers', customerStats);

    const customerIds = new Set(customers.map((c) => c.id));

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 2: Sync completed tickets (ticket.completed)
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n━━━ PHASE 2: Syncing Completed Tickets ━━━━━━━━━━━━━━━━━━━━━━');

    const tickets = await prisma.ticket.findMany({
      where: {
        orgId: ORG_ID,
        status: 'COMPLETED',
        customerId: { not: null },
      },
      select: {
        id: true,
        customerId: true,
        branchId: true,
        serviceId: true,
        createdAt: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    console.log(`Found ${tickets.length} completed tickets to sync.\n`);

    const ticketStats = newStats();
    for (let i = 0; i < tickets.length; i++) {
      const t = tickets[i];
      if (!t.customerId || !customerIds.has(t.customerId)) continue;

      const label = `ticket ${i + 1}/${tickets.length} (${t.id})`;
      if (i > 0 && i % 100 === 0) {
        console.log(
          `  📦 Progress: ${i}/${tickets.length} (${ticketStats.success} ok, ${ticketStats.failed} failed)`,
        );
      }

      await sendEvent(
        {
          event: 'ticket.completed',
          sourceId: t.id,
          branchId: t.branchId || undefined,
          serviceId: t.serviceId || undefined,
          occurredAt: t.createdAt.toISOString(),
          customer: t.customerId
            ? {
                externalId: t.customerId,
                name: t.customerName || 'Unknown',
                email: t.customerEmail || undefined,
                phone: t.customerPhone || undefined,
              }
            : undefined,
        },
        ticketStats,
        label,
      );

      await delay(BASE_DELAY_MS);
    }
    printStats('PHASE 2: Tickets', ticketStats);

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 3: Sync ticket no-shows (ticket.no_show)
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n━━━ PHASE 3: Syncing Ticket No-Shows ━━━━━━━━━━━━━━━━━━━━━━━━');

    const noShowTickets = await prisma.ticket.findMany({
      where: {
        orgId: ORG_ID,
        status: 'NO_SHOW',
        customerId: { not: null },
      },
      select: {
        id: true,
        customerId: true,
        branchId: true,
        createdAt: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    console.log(`Found ${noShowTickets.length} no-show tickets to sync.\n`);

    const noShowTicketStats = newStats();
    for (let i = 0; i < noShowTickets.length; i++) {
      const t = noShowTickets[i];
      if (!t.customerId || !customerIds.has(t.customerId)) continue;

      const label = `no-show-ticket ${i + 1}/${noShowTickets.length} (${t.id})`;

      await sendEvent(
        {
          event: 'ticket.no_show',
          sourceId: t.id,
          branchId: t.branchId || undefined,
          occurredAt: t.createdAt.toISOString(),
          customer: t.customerId
            ? {
                externalId: t.customerId,
                name: t.customerName || 'Unknown',
                email: t.customerEmail || undefined,
                phone: t.customerPhone || undefined,
              }
            : undefined,
        },
        noShowTicketStats,
        label,
      );

      await delay(BASE_DELAY_MS);
    }
    printStats('PHASE 3: No-Show Tickets', noShowTicketStats);

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 4: Sync completed appointments (appointment.completed)
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n━━━ PHASE 4: Syncing Completed Appointments ━━━━━━━━━━━━━━━━━');

    const appointments = await prisma.appointment.findMany({
      where: {
        orgId: ORG_ID,
        status: 'COMPLETED',
      },
      select: {
        id: true,
        branchId: true,
        createdAt: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    console.log(`Found ${appointments.length} completed appointments to sync.\n`);

    const appointmentStats = newStats();
    for (let i = 0; i < appointments.length; i++) {
      const a = appointments[i];

      const label = `appointment ${i + 1}/${appointments.length} (${a.id})`;

      await sendEvent(
        {
          event: 'appointment.completed',
          sourceId: a.id,
          branchId: a.branchId || undefined,
          customerPhone: a.customerPhone || undefined,
          customerEmail: a.customerEmail || undefined,
          occurredAt: a.createdAt.toISOString(),
          // Note: appointment has no customerId in QlessQ!
          // so we just pass phone/email.
          customer: undefined,
        },
        appointmentStats,
        label,
      );

      await delay(BASE_DELAY_MS);
    }
    printStats('PHASE 4: Appointments', appointmentStats);

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 5: Sync appointment no-shows (appointment.no_show)
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n━━━ PHASE 5: Syncing Appointment No-Shows ━━━━━━━━━━━━━━━━━━━');

    const noShowAppts = await prisma.appointment.findMany({
      where: {
        orgId: ORG_ID,
        status: 'NO_SHOW',
      },
      select: {
        id: true,
        branchId: true,
        createdAt: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    console.log(`Found ${noShowAppts.length} no-show appointments to sync.\n`);

    const noShowApptStats = newStats();
    for (let i = 0; i < noShowAppts.length; i++) {
      const a = noShowAppts[i];

      const label = `no-show-appt ${i + 1}/${noShowAppts.length} (${a.id})`;

      await sendEvent(
        {
          event: 'appointment.no_show',
          sourceId: a.id,
          branchId: a.branchId || undefined,
          customerPhone: a.customerPhone || undefined,
          customerEmail: a.customerEmail || undefined,
          occurredAt: a.createdAt.toISOString(),
          customer: undefined,
        },
        noShowApptStats,
        label,
      );

      await delay(BASE_DELAY_MS);
    }
    printStats('PHASE 5: No-Show Appointments', noShowApptStats);

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 6: Sync reviews (review.submitted)
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n━━━ PHASE 6: Syncing Reviews ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const reviews = await prisma.review.findMany({
      where: {
        orgId: ORG_ID,
      },
      select: {
        id: true,
        rating: true,
        createdAt: true,
        customerName: true,
        customerEmail: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    console.log(`Found ${reviews.length} reviews to sync.\n`);

    const reviewStats = newStats();
    for (let i = 0; i < reviews.length; i++) {
      const r = reviews[i];

      const label = `review ${i + 1}/${reviews.length} (${r.id})`;

      await sendEvent(
        {
          event: 'review.submitted',
          sourceId: r.id,
          rating: r.rating,
          occurredAt: r.createdAt.toISOString(),
          customer: undefined,
        },
        reviewStats,
        label,
      );

      await delay(BASE_DELAY_MS);
    }
    printStats('PHASE 6: Reviews', reviewStats);

    // ═══════════════════════════════════════════════════════════════════
    // FINAL SUMMARY
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║   BACKFILL COMPLETE — FINAL SUMMARY                        ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log(`\n   Customers:       ${customerStats.success}/${customerStats.attempted} synced`);
    console.log(`   Tickets:         ${ticketStats.success}/${ticketStats.attempted} synced`);
    console.log(
      `   No-Show Tickets: ${noShowTicketStats.success}/${noShowTicketStats.attempted} synced`,
    );
    console.log(
      `   Appointments:    ${appointmentStats.success}/${appointmentStats.attempted} synced`,
    );
    console.log(
      `   No-Show Appts:   ${noShowApptStats.success}/${noShowApptStats.attempted} synced`,
    );
    console.log(`   Reviews:         ${reviewStats.success}/${reviewStats.attempted} synced`);

    const totalSuccess =
      customerStats.success +
      ticketStats.success +
      noShowTicketStats.success +
      appointmentStats.success +
      noShowApptStats.success +
      reviewStats.success;
    const totalAttempted =
      customerStats.attempted +
      ticketStats.attempted +
      noShowTicketStats.attempted +
      appointmentStats.attempted +
      noShowApptStats.attempted +
      reviewStats.attempted;
    const totalFailed =
      customerStats.failed +
      ticketStats.failed +
      noShowTicketStats.failed +
      appointmentStats.failed +
      noShowApptStats.failed +
      reviewStats.failed;

    console.log(`\n   TOTAL: ${totalSuccess}/${totalAttempted} synced, ${totalFailed} failed`);

    if (totalFailed > 0) {
      console.log('\n   ⚠️  Some records failed. Check errors above.');
    } else {
      console.log('\n   ✅ ALL records synced successfully!');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
