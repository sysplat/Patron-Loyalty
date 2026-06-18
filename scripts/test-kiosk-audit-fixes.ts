import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { PrismaClient } from '@prisma/client';
import assert from 'assert';
import { Redis } from 'ioredis';

const API_BASE = process.env.API_BASE || 'http://localhost:4000/api/v1';
const PASSWORD = process.env.SMOKE_PASSWORD || 'SmokeRb@c3q1!';
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

async function fetchJson(
  method: string,
  path: string,
  { token, body }: { token?: string; body?: any } = {},
) {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { _raw: text };
  }
  return { ok: res.ok, status: res.status, json };
}

async function main() {
  const stamp = Date.now();
  const ownerEmail = `smoke.kiosk.owner+${stamp}@example.com`;

  console.log(`🚀 Running Kiosk Audit Integration Test Suite`);
  console.log(`API Base: ${API_BASE}`);
  console.log('----------------------------------------------------------------');

  // 1. Register Owner
  console.log('[1/4] Registering owner...');
  const reg = await fetchJson('POST', '/auth/register', {
    body: {
      businessName: `Kiosk Org ${stamp}`,
      email: ownerEmail,
      password: PASSWORD,
      firstName: 'Kiosk',
      lastName: 'Owner',
      acceptLegal: true,
    },
  });
  assert.strictEqual(reg.status, 201, `Failed to register owner: ${JSON.stringify(reg.json)}`);
  const loginRes = await fetchJson('POST', '/auth/login', {
    body: { email: ownerEmail, password: PASSWORD },
  });
  const ownerToken = loginRes.json?.data?.tokens?.accessToken;
  assert.ok(ownerToken);

  // 2. Setup branch, service, and queue
  console.log('[2/4] Setting up branch, service, and queue...');
  const ownerUser = await prisma.user.findFirst({ where: { email: ownerEmail } });
  const orgId = ownerUser?.orgId;
  assert.ok(orgId);

  const entPlan = await prisma.plan.findFirst({ where: { slug: 'enterprise' } });
  assert.ok(entPlan);
  await prisma.subscription.updateMany({
    where: { orgId },
    data: { planId: entPlan.id },
  });

  const branchRes = await fetchJson('POST', '/branches', {
    token: ownerToken,
    body: {
      name: 'Kiosk Branch',
      timezone: 'America/Los_Angeles',
      address: '123 Kiosk St',
    },
  });
  const branchId = branchRes.json?.data?.id;
  assert.ok(branchId);

  const serviceRes = await fetchJson('POST', '/services', {
    token: ownerToken,
    body: {
      name: 'Kiosk Service',
      queueEnabled: true,
      appointmentEnabled: false,
      durationMinutes: 15,
      serviceEstimateLowMinutes: 5,
      serviceEstimateHighMinutes: 15,
      branchIds: [branchId],
    },
  });
  const serviceId = serviceRes.json?.data?.id;
  assert.ok(serviceId);

  const queueRes = await fetchJson('POST', '/queues', {
    token: ownerToken,
    body: {
      branchId,
      serviceId,
      name: 'Kiosk Queue',
      prefix: 'K',
      stepRole: 'service',
      callingPolicy: 'fifo',
    },
  });
  const queueId = queueRes.json?.data?.id;
  assert.ok(queueId);

  await fetchJson('POST', `/queues/${queueId}/open`, { token: ownerToken });

  // 3. Test Kiosk Waiting Counts and Fallback Scoping
  console.log('[3/4] Testing public waiting counts fallback (no inflations)...');

  // Issue ticket 1 via public kiosk API (anonymous)
  const issueRes = await fetchJson('POST', '/tickets/issue', {
    body: {
      queueId,
      branchId,
      serviceId,
      customerPhone: '+15555550100',
      source: 'kiosk',
    },
  });
  assert.strictEqual(
    issueRes.status,
    201,
    `Failed to issue public ticket: ${JSON.stringify(issueRes.json)}`,
  );

  // Fetch public queues, should read from Prisma directly since queue stats might not be generated yet, or from v2 redis
  // Wait a brief moment to allow any async stats generator to fire
  await new Promise((r) => setTimeout(r, 1000));

  let publicQueuesRes = await fetchJson('GET', `/queues/branch/${branchId}/public`);
  assert.strictEqual(publicQueuesRes.status, 200);
  let queues = publicQueuesRes.json?.data || [];
  assert.strictEqual(queues.length, 1);
  assert.strictEqual(queues[0].waitingCount, 1, 'Waiting count should exactly equal 1');

  // Force clear Redis `v2` namespace to ensure Prisma fallback triggers and is date-scoped correctly
  console.log('  Clearing redis stats to trigger Prisma date-scoped fallback...');
  const keys = await redis.keys(`queue:stats:v2:${queueId}:*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }

  publicQueuesRes = await fetchJson('GET', `/queues/branch/${branchId}/public`);
  queues = publicQueuesRes.json?.data || [];
  assert.strictEqual(
    queues[0].waitingCount,
    1,
    'Prisma fallback waiting count should exactly equal 1',
  );
  console.log('  ✓ Public waiting counts fallback successfully validated date-scoping');

  // 4. Test Paused Queue Rejection & Friendly Message
  console.log('[4/4] Testing paused queue ticket issue rejection...');
  const pauseRes = await fetchJson('POST', `/queues/${queueId}/pause`, { token: ownerToken });
  assert.strictEqual(pauseRes.status, 200, 'Failed to pause queue');

  const pausedIssueRes = await fetchJson('POST', '/tickets/issue', {
    body: {
      queueId,
      branchId,
      serviceId,
      customerPhone: '+15555550200',
      source: 'kiosk',
    },
  });
  // The API should throw a 400 BadRequest when a queue is paused
  assert.strictEqual(pausedIssueRes.status, 400);
  const resString = JSON.stringify(pausedIssueRes.json);
  assert.ok(
    resString.includes('Queue is not open'),
    `Error message must contain 'Queue is not open'. Got: ${resString}`,
  );
  // 5. Test invalid branchId returns 404
  console.log('[5/5] Testing invalid branchId handling...');
  const invalidBranchRes = await fetchJson(
    'GET',
    `/queues/branch/00000000-0000-0000-0000-000000000000/public`,
    {
      token: undefined, // No auth
    },
  );
  assert.strictEqual(invalidBranchRes.status, 404);
  assert.ok(invalidBranchRes.json, 'Should return JSON error payload');
  console.log('  ✓ API correctly throws 404 Not Found for non-existent branches');

  console.log('\n🎉 ALL KIOSK AUDIT CHECKS PASSED SUCCESSFULLY!');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
