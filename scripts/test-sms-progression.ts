import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:4000/api/v1';

async function fetchJson(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`Error ${res.status} on ${path}:`, JSON.stringify(json, null, 2));
  }
  return { ok: res.ok, status: res.status, data: json.data, json };
}

async function main() {
  console.log('🚀 Testing SMS Progression for +1 604 861 8530...\n');

  const stamp = Date.now().toString().slice(-6);
  const email = `tester-${stamp}@example.com`;
  const password = 'Password123!';

  // 1. Register a NEW ORG
  console.log('📝 Registering new organization...');
  const reg = await fetchJson('POST', '/auth/register', {
    body: {
      businessName: `SMS Test Org ${stamp}`,
      firstName: 'SMS',
      lastName: 'Tester',
      email,
      password,
      acceptLegal: true,
    },
  });
  if (!reg.ok) throw new Error(`Registration failed`);

  // Bypass verification
  await prisma.account.update({ where: { email }, data: { emailVerified: true } });
  await prisma.user.updateMany({ where: { email }, data: { emailVerified: true } });

  const login = await fetchJson('POST', '/auth/login', {
    body: { email, password },
  });
  const token = login.data.tokens.accessToken;
  const orgId = login.data.user.orgId;

  // 2. Setup Service, Branch, Queue, Desk
  console.log('🏗️ Setting up Service, Branch, Queue, and Desk...');

  const service = await fetchJson('POST', '/services', {
    token,
    body: {
      name: 'General Service',
      durationMinutes: 15,
      serviceEstimateLowMinutes: 5,
      serviceEstimateHighMinutes: 10,
    },
  });
  if (!service.ok) throw new Error('Service creation failed');
  const serviceId = service.data.id;

  const branch = await fetchJson('POST', '/branches', {
    token,
    body: { name: 'Test Branch', timezone: 'America/New_York' },
  });
  if (!branch.ok) throw new Error('Branch creation failed');
  const branchId = branch.data.id;

  const queue = await fetchJson('POST', '/queues', {
    token,
    body: { branchId, serviceId, name: 'Main Queue', prefix: 'A' },
  });
  if (!queue.ok) throw new Error('Queue creation failed');
  const queueId = queue.data.id;

  await fetchJson('POST', `/queues/${queueId}/open`, { token });

  const desk = await prisma.desk.create({
    data: { branchId, number: '1', name: 'Desk 1', status: 'open', orgId },
  });
  const deskNumber = '1';

  const TEST_PHONE = '+16048618530';
  console.log(`📍 Org: ${orgId}, Branch: ${branchId}, Queue: ${queueId}`);

  // 3. Issue 4 tickets
  console.log('🎟️ Issuing 4 tickets...');
  const ticketIds = [];
  for (let i = 1; i <= 4; i++) {
    const res = await fetchJson('POST', '/tickets/issue', {
      body: {
        orgId,
        branchId,
        serviceId,
        queueId,
        firstName: `Tester ${i}`,
        customerPhone: TEST_PHONE,
        source: 'kiosk',
      },
    });
    if (!res.ok) {
      throw new Error('Ticket issue failed');
    }

    // Log the body if data is missing
    if (!res.data) {
      console.log(`FULL RESPONSE FOR TICKET ${i}:`, JSON.stringify(res.json, null, 2));
      // Maybe it's not wrapped in .data for public issue?
      var tid = res.json.id || res.json.data?.id;
      var dno = res.json.displayNumber || res.json.data?.displayNumber;
    } else {
      var tid = res.data.id;
      var dno = res.data.displayNumber;
    }

    if (!tid) throw new Error('No ticket ID returned');

    ticketIds.push(tid);
    console.log(`  Ticket ${i}: ${dno} (${tid})`);
  }

  async function checkLastNotifications() {
    console.log('  (Waiting for notifications...)');
    await new Promise((r) => setTimeout(r, 2000));
    const notifs = await prisma.notification.findMany({
      where: { orgId, channel: 'sms', payload: { path: ['to'], equals: TEST_PHONE } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    console.log(`\n🔔 Notifications for ${TEST_PHONE}:`);
    if (notifs.length === 0) console.log('  No notifications found yet.');
    notifs.forEach((n) => {
      const p = n.payload as any;
      console.log(`  [${n.status}] Body: ${p.body}`);
    });
  }

  console.log('\n📣 Calling Ticket 1 (Next)...');
  await fetchJson('POST', `/tickets/call-next`, {
    token,
    body: { queueId, deskNumber },
  });
  await checkLastNotifications();

  console.log('\n📣 Calling Ticket 2 (Next)...');
  await fetchJson('POST', `/tickets/call-next`, {
    token,
    body: { queueId, deskNumber },
  });
  await checkLastNotifications();

  console.log('\n📣 Calling Ticket 3 (Next)...');
  await fetchJson('POST', `/tickets/call-next`, {
    token,
    body: { queueId, deskNumber },
  });
  await checkLastNotifications();

  console.log('\n✨ SMS PROGRESSION TEST COMPLETE!');
}

main()
  .catch((err) => {
    console.error('Final Crash:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
