#!/usr/bin/env node
/**
 * Patron loyalty smoke — enable CRM for an org and verify points earn on visit completion.
 *
 * Usage:
 *   node scripts/smoke-loyalty-earn.mjs
 *   LOYALTY_SMOKE_EMAIL=parsasamandizadeh@gmail.com node scripts/smoke-loyalty-earn.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const require = createRequire(path.join(root, 'packages/database/package.json'));
const { PrismaClient } = require('@prisma/client');
const Redis = require('ioredis');

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(path.join(root, '.env'));
loadEnvFile(path.join(root, '.env.local'));

const prisma = new PrismaClient();
const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1 })
  : null;

const email = process.env.LOYALTY_SMOKE_EMAIL ?? 'parsasamandizadeh@gmail.com';

async function main() {
  console.log(`[loyalty-smoke] Looking up org for ${email}...`);
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { orgId: true, email: true },
  });
  if (!user) {
    throw new Error(`No user found for ${email}`);
  }

  const org = await prisma.organization.update({
    where: { id: user.orgId },
    data: { patronCrmEnabled: true },
    select: { id: true, name: true, patronCrmEnabled: true },
  });
  console.log(`[loyalty-smoke] Enabled patron CRM for "${org.name}" (${org.id})`);

  if (redis) {
    await redis.del(`feature:patronCrmEnabled:${org.id}`);
    console.log('[loyalty-smoke] Cleared patron CRM feature cache');
    redis.disconnect();
  }

  let program = await prisma.loyaltyProgram.findUnique({ where: { orgId: org.id } });
  if (!program) {
    program = await prisma.loyaltyProgram.create({ data: { orgId: org.id } });
    console.log('[loyalty-smoke] Created loyalty program');
  }

  let customer = await prisma.customer.findFirst({
    where: { orgId: org.id },
    orderBy: { createdAt: 'desc' },
  });

  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        orgId: org.id,
        name: 'Loyalty Smoke Patron',
        email: `loyalty-smoke-${Date.now()}@example.com`,
      },
    });
    console.log('[loyalty-smoke] Created test customer', customer.id);
  }

  let account = await prisma.loyaltyAccount.findUnique({ where: { customerId: customer.id } });
  if (!account) {
    const bronze = await prisma.loyaltyTier.findFirst({
      where: { orgId: org.id, slug: 'bronze' },
    });
    account = await prisma.loyaltyAccount.create({
      data: {
        orgId: org.id,
        customerId: customer.id,
        referralCode: `SMK${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        tierId: bronze?.id ?? null,
        wallet: { create: { orgId: org.id, balanceCents: 0 } },
      },
    });
    console.log('[loyalty-smoke] Created loyalty account', account.id);
  }

  const earnPoints = program.defaultEarnPoints ?? 10;
  const balanceBefore = account.pointsBalance;

  await prisma.$transaction(async (tx) => {
    const updated = await tx.loyaltyAccount.update({
      where: { id: account.id },
      data: {
        pointsBalance: { increment: earnPoints },
        lifetimePointsEarned: { increment: earnPoints },
        totalVisits: { increment: 1 },
      },
    });
    await tx.loyaltyPointLedger.create({
      data: {
        orgId: org.id,
        accountId: account.id,
        type: 'EARN',
        points: earnPoints,
        balanceAfter: updated.pointsBalance,
        sourceType: 'ticket',
        sourceId: null,
        description: 'Smoke test — simulated completed visit',
      },
    });
  });

  const after = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { id: account.id } });
  console.log(
    `[loyalty-smoke] Points ${balanceBefore} → ${after.pointsBalance} (+${earnPoints}) visits=${after.totalVisits}`,
  );

  const ledger = await prisma.loyaltyPointLedger.findFirst({
    where: { accountId: account.id },
    orderBy: { createdAt: 'desc' },
  });
  if (!ledger || ledger.type !== 'EARN') {
    throw new Error('Expected EARN ledger entry');
  }

  console.log('[loyalty-smoke] OK — patron CRM enabled and earn ledger verified');
  console.log('[loyalty-smoke] Open loyalty app: http://localhost:3003 (pnpm dev:loyalty)');
}

main()
  .catch((err) => {
    console.error('[loyalty-smoke] FAILED', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
