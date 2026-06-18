/**
 * Creates (or refreshes) one open single-step queue for kiosk + Single-step console testing.
 *
 * Run from repo root:
 *   pnpm --filter @queueplatform/database setup:single-desk-kiosk
 *
 * Optional env:
 *   BRANCH_NAME="City Medical Center"   — branch by name (any org in the database)
 *   KIOSK_SERVICE_NAME="Walk-in Desk"  — service label on kiosk
 *   LIST_ORGS=1                         — print orgs/branches and exit (debug visibility)
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';

config({ path: resolve(__dirname, '../../../.env') });
config({ path: resolve(__dirname, '../../../.env.local'), override: false });

const BRANCH_NAME = process.env.BRANCH_NAME?.trim();
const SERVICE_NAME = process.env.KIOSK_SERVICE_NAME?.trim() || 'Walk-in Desk';
const SERVICE_SLUG = 'single-desk-walk-in';
const QUEUE_NAME = 'Single Desk';
const QUEUE_PREFIX = 'A';
const WEB_BASE = process.env.APP_URL?.replace(/\/$/, '') || 'http://localhost:3001';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

async function main() {
  const prisma = new PrismaClient();

  try {
    if (process.env.LIST_ORGS === '1') {
      const orgs = await prisma.organization.findMany({
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
          branches: { select: { id: true, name: true }, orderBy: { createdAt: 'asc' } },
        },
      });
      console.log('\nOrganizations and branches in this database:\n');
      for (const o of orgs) {
        console.log(`• ${o.name} (${o.id})`);
        for (const b of o.branches) {
          console.log(`    - ${b.name}  →  /kiosk/${b.id}`);
        }
      }
      console.log(
        '\nDashboard Branches page only lists branches in your logged-in organization.\n',
      );
      return;
    }

    let orgId: string;
    let orgName: string;
    let branch: { id: string; name: string } | null = null;

    if (BRANCH_NAME) {
      const row = await prisma.branch.findFirst({
        where: { name: BRANCH_NAME },
        select: {
          id: true,
          name: true,
          orgId: true,
          organization: { select: { name: true } },
        },
      });
      if (!row) {
        throw new Error(
          `Branch "${BRANCH_NAME}" not found. Run LIST_ORGS=1 pnpm setup:single-desk-kiosk to see all branches.`,
        );
      }
      branch = { id: row.id, name: row.name };
      orgId = row.orgId;
      orgName = row.organization.name;
      console.log(`✓ Branch "${branch.name}" belongs to org: ${orgName}`);
    } else {
      const org = await prisma.organization.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true },
      });
      if (!org) {
        throw new Error('No organization found. Run db:seed or create an org first.');
      }
      orgId = org.id;
      orgName = org.name;
      branch = await prisma.branch.findFirst({
        where: { orgId, status: 'active' },
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true },
      });
    }

    if (!branch) {
      const name = 'Single Desk Kiosk Branch';
      branch = await prisma.branch.create({
        data: {
          orgId,
          name,
          slug: `${slugify(name)}-${Date.now()}`,
          status: 'active',
        },
        select: { id: true, name: true },
      });
      console.log(`✓ Created branch: ${branch.name} in org ${orgName}`);
    } else {
      console.log(`✓ Using branch: ${branch.name} (org: ${orgName})`);
    }

    const branchId = branch.id;

    // Single-step kiosk: no active multi-step flow on this branch.
    const deactivated = await prisma.branchFlowTemplate.updateMany({
      where: { orgId, branchId, isActive: true },
      data: { isActive: false },
    });
    if (deactivated.count > 0) {
      console.log(`✓ Deactivated ${deactivated.count} active flow template(s) on this branch`);
    }

    await prisma.branch.update({
      where: { id: branchId },
      data: { defaultJourneyMode: 'single_ticket' },
    });

    let service = await prisma.service.findFirst({
      where: { orgId, slug: SERVICE_SLUG },
    });

    const serviceData = {
      name: SERVICE_NAME,
      description: 'Single-desk walk-in queue for kiosk testing',
      queueEnabled: true,
      appointmentEnabled: false,
      serviceEstimateLowMinutes: 5,
      serviceEstimateHighMinutes: 15,
      journeyModeOverride: 'single_ticket' as const,
      instructionalTip: 'Keep your passport or ID card ready when your number is called.',
      status: 'active' as const,
    };

    service = service
      ? await prisma.service.update({
          where: { id: service.id },
          data: serviceData,
        })
      : await prisma.service.create({
          data: { orgId, slug: SERVICE_SLUG, ...serviceData },
        });

    await prisma.branchService.upsert({
      where: { branchId_serviceId: { branchId, serviceId: service.id } },
      create: { branchId, serviceId: service.id, isActive: true },
      update: { isActive: true },
    });
    console.log(`✓ Service: ${service.name} (single-step)`);

    const existingQueue = await prisma.queue.findFirst({
      where: { orgId, branchId, name: QUEUE_NAME },
    });

    const queueData = {
      serviceId: service.id,
      name: QUEUE_NAME,
      prefix: QUEUE_PREFIX,
      status: 'open' as const,
      callingPolicy: 'fifo' as const,
      journeyModeOverride: 'single_ticket' as const,
      flowTemplateId: null,
      stepRole: null,
      minServiceMinutes: 5,
      maxServiceMinutes: 15,
      sessionOpenedAt: new Date(),
    };

    const queue = existingQueue
      ? await prisma.queue.update({
          where: { id: existingQueue.id },
          data: queueData,
        })
      : await prisma.queue.create({
          data: { orgId, branchId, ...queueData },
        });

    console.log(`✓ Queue: ${queue.name} (${queue.prefix}-###) — OPEN`);

    await prisma.desk.upsert({
      where: { branchId_number: { branchId, number: '1' } },
      create: {
        orgId,
        branchId,
        name: 'Desk 1',
        number: '1',
        status: 'open',
      },
      update: { status: 'open', name: 'Desk 1' },
    });
    console.log('✓ Desk 1 — OPEN');

    const kioskUrl = `${WEB_BASE}/kiosk/${branchId}`;
    const serveUrl = `${WEB_BASE}/dashboard/single-step`;
    const localKiosk = `http://localhost:3001/kiosk/${branchId}`;
    const localServe = 'http://localhost:3001/dashboard/single-step';

    console.log('\n--- Single-desk kiosk ready ---\n');
    console.log(`Organization: ${orgName}`);
    console.log(`Branch:       ${branch.name}`);
    console.log(`Branch ID:    ${branchId}`);
    console.log(`Queue ID:     ${queue.id}`);
    console.log(`Service ID:   ${service.id}`);
    console.log(`\nKiosk (customers):  ${kioskUrl}`);
    if (!WEB_BASE.includes('localhost')) {
      console.log(`Kiosk (local dev):  ${localKiosk}`);
    }
    console.log(`Staff console:      ${serveUrl}`);
    if (!WEB_BASE.includes('localhost')) {
      console.log(`Staff (local dev):  ${localServe}`);
    }
    console.log(
      '\nIn Single-step console: select this branch, queue "' + QUEUE_NAME + '", desk 1.',
    );
    console.log('Kiosk shows one service: "' + SERVICE_NAME + '".\n');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
