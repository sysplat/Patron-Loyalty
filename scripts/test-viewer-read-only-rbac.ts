import { PrismaClient } from '@prisma/client';
import assert from 'assert';

const API_BASE = process.env.API_BASE || 'http://localhost:4000/api/v1';
const PASSWORD = process.env.SMOKE_PASSWORD || 'SmokeRb@c3q1!';
const prisma = new PrismaClient();

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

async function login(email: string) {
  const r = await fetchJson('POST', '/auth/login', {
    body: { email: email.toLowerCase(), password: PASSWORD },
  });
  if (r.status !== 200) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(r.json)}`);
  }
  const access = r.json?.data?.tokens?.accessToken;
  if (!access) throw new Error('Login response missing access token');
  return access;
}

async function main() {
  const stamp = Date.now();
  const ownerEmail = `smoke.viewer.owner+${stamp}@example.com`;
  const viewerEmail = `smoke.viewer.usr+${stamp}@example.com`;

  console.log(`🚀 Running Viewer Read-Only Permissions Smoke Test`);
  console.log(`API Base: ${API_BASE}`);
  console.log('------------------------------------------------');

  // 1. Register Owner
  console.log('[1/7] Registering owner...');
  const reg = await fetchJson('POST', '/auth/register', {
    body: {
      businessName: `Viewer Test Org ${stamp}`,
      email: ownerEmail,
      password: PASSWORD,
      firstName: 'Owner',
      lastName: 'Smoke',
      acceptLegal: true,
    },
  });
  assert.ok(
    reg.status === 200 || reg.status === 201,
    `Failed to register owner: ${JSON.stringify(reg.json)}`,
  );

  // 1.5 Bypass verification via Prisma
  console.log('[1.5/7] Bypassing verification via Prisma...');
  const ownerUser = await prisma.user.findFirst({ where: { email: ownerEmail } });
  if (!ownerUser) throw new Error('Registered owner user not found in database');
  await prisma.user.update({
    where: { id: ownerUser.id },
    data: { emailVerified: true, status: 'active' },
  });

  const ownerToken = await login(ownerEmail);

  // 2. Fetch Roles
  console.log('[2/7] Retrieving role list...');
  const rolesRes = await fetchJson('GET', '/roles', { token: ownerToken });
  const roles = rolesRes.json?.data || [];
  const viewerRole = roles.find((r: any) => r.name.toLowerCase() === 'viewer');
  if (!viewerRole) throw new Error('Viewer role not found in system roles');

  // 3. Setup Branch, Desk, Service, Queue
  console.log('[3/7] Setting up branch and service queues...');
  const branchRes = await fetchJson('POST', '/branches', {
    token: ownerToken,
    body: { name: 'Viewer Test Branch', timezone: 'UTC' },
  });
  const branchId = branchRes.json?.data?.id ?? branchRes.json?.id;
  assert.ok(branchId, 'Failed to create branch');

  const deskRes = await fetchJson('POST', '/desks', {
    token: ownerToken,
    body: { branchId, name: 'Desk 1', number: '1' },
  });
  const deskId = deskRes.json?.data?.id ?? deskRes.json?.id;
  await fetchJson('PATCH', `/desks/${deskId}`, {
    token: ownerToken,
    body: { status: 'open' },
  });

  const svcRes = await fetchJson('POST', '/services', {
    token: ownerToken,
    body: {
      name: 'Viewer Test Service',
      queueEnabled: true,
      appointmentEnabled: false,
      durationMinutes: 15,
      serviceEstimateLowMinutes: 5,
      serviceEstimateHighMinutes: 15,
      branchIds: [branchId],
    },
  });
  const serviceId = svcRes.json?.data?.id ?? svcRes.json?.id;

  const queueRes = await fetchJson('POST', '/queues', {
    token: ownerToken,
    body: {
      branchId,
      serviceId,
      name: 'Viewer Queue',
      prefix: 'VWR',
    },
  });
  const queueId = queueRes.json?.data?.id ?? queueRes.json?.id;

  // Open the queue
  await fetchJson('POST', `/queues/${queueId}/open`, { token: ownerToken });

  // 4. Invite Viewer
  console.log('[4/7] Inviting viewer user...');
  const inviteRes = await fetchJson('POST', '/users/invite', {
    token: ownerToken,
    body: {
      email: viewerEmail,
      firstName: 'Viewer',
      lastName: 'Smoke',
      roleId: viewerRole.id,
      password: PASSWORD,
      branchIds: [branchId],
    },
  });
  assert.ok(
    inviteRes.status === 200 || inviteRes.status === 201,
    `Failed to invite viewer: ${JSON.stringify(inviteRes.json)}`,
  );
  const viewerUserId = inviteRes.json?.data?.id ?? inviteRes.json?.id;

  // Active viewer in DB
  await prisma.user.update({
    where: { id: viewerUserId },
    data: { emailVerified: true, status: 'active' },
  });

  const viewerToken = await login(viewerEmail);

  // 5. Issue ticket as Owner (to have a ticket to act upon)
  console.log('[5/7] Issuing a public ticket...');
  const ticketRes = await fetchJson('POST', '/tickets/issue', {
    body: {
      branchId,
      queueId,
      serviceId,
      source: 'smoke',
      customerName: 'Viewer Test Customer',
    },
  });
  const ticketId = ticketRes.json?.data?.id ?? ticketRes.json?.id;
  assert.ok(ticketId, 'Failed to issue ticket');

  // Call ticket as Owner so it is in 'called' status
  const callRes = await fetchJson('POST', '/tickets/call-next', {
    token: ownerToken,
    body: { queueId, deskNumber: '1', deskFilterActive: false },
  });
  assert.strictEqual(callRes.status, 200, 'Owner should call ticket successfully');

  // 6. Assert Viewer is STRICTLY DENIED write transitions
  console.log('[6/7] Verifying Viewer role is blocked from modifying tickets...');

  // call-next denied
  const tryCallNext = await fetchJson('POST', '/tickets/call-next', {
    token: viewerToken,
    body: { queueId, deskNumber: '1', deskFilterActive: false },
  });
  assert.strictEqual(
    tryCallNext.status,
    403,
    'Viewer should be forbidden from calling next ticket',
  );
  console.log('  ✓ POST /tickets/call-next → 403 (Forbidden)');

  // no-show denied
  const tryNoShow = await fetchJson('POST', `/tickets/${ticketId}/no-show`, {
    token: viewerToken,
  });
  assert.strictEqual(
    tryNoShow.status,
    403,
    'Viewer should be forbidden from marking ticket no-show',
  );
  console.log('  ✓ POST /tickets/:id/no-show → 403 (Forbidden)');

  // complete denied
  const tryComplete = await fetchJson('POST', `/tickets/${ticketId}/complete`, {
    token: viewerToken,
  });
  assert.strictEqual(tryComplete.status, 403, 'Viewer should be forbidden from completing ticket');
  console.log('  ✓ POST /tickets/:id/complete → 403 (Forbidden)');

  // cancel denied
  const tryCancel = await fetchJson('POST', `/tickets/${ticketId}/cancel`, {
    token: viewerToken,
  });
  assert.strictEqual(tryCancel.status, 403, 'Viewer should be forbidden from canceling ticket');
  console.log('  ✓ POST /tickets/:id/cancel → 403 (Forbidden)');

  // recall denied
  const tryRecall = await fetchJson('POST', `/tickets/${ticketId}/recall`, {
    token: viewerToken,
  });
  assert.strictEqual(tryRecall.status, 403, 'Viewer should be forbidden from recalling ticket');
  console.log('  ✓ POST /tickets/:id/recall → 403 (Forbidden)');

  // transfer denied
  const tryTransfer = await fetchJson('POST', `/tickets/${ticketId}/transfer`, {
    token: viewerToken,
    body: { targetQueueId: queueId },
  });
  assert.strictEqual(
    tryTransfer.status,
    403,
    'Viewer should be forbidden from transferring ticket',
  );
  console.log('  ✓ POST /tickets/:id/transfer → 403 (Forbidden)');

  // 7. Verify read operations are still allowed for Viewer
  console.log('[7/7] Verifying Viewer can still perform read actions...');
  const readTicket = await fetchJson('GET', `/tickets/${ticketId}`, {
    token: viewerToken,
  });
  assert.strictEqual(readTicket.status, 200, 'Viewer should be able to view tickets');
  console.log('  ✓ GET /tickets/:id → 200 (OK)');

  const readQueue = await fetchJson('GET', `/queues/${queueId}`, {
    token: viewerToken,
  });
  assert.strictEqual(readQueue.status, 200, 'Viewer should be able to view queues');
  console.log('  ✓ GET /queues/:id → 200 (OK)');

  console.log('\n🎉 ALL VIEWER PERMISSION CHECKS PASSED SUCCESSFULLY!');
}

main()
  .catch((err) => {
    console.error('\n❌ TEST FAILED');
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
