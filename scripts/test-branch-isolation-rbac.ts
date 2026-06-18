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
  const ownerEmail = `smoke.bi.owner+${stamp}@example.com`;
  const adminAEmail = `smoke.bi.admina+${stamp}@example.com`;
  const adminBEmail = `smoke.bi.adminb+${stamp}@example.com`;
  const managerAEmail = `smoke.bi.managera+${stamp}@example.com`;

  console.log(`🚀 Running Branch Isolation RBAC (Flows) Smoke Test`);
  console.log(`API Base: ${API_BASE}`);
  console.log('------------------------------------------------');

  // 1. Register Owner
  console.log('[1/12] Registering organization and owner...');
  const reg = await fetchJson('POST', '/auth/register', {
    body: {
      businessName: `BI Test Org ${stamp}`,
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

  // 1.5 Bypass verification via Prisma & Upgrade to Enterprise to support multiple branches
  console.log('[1.5/12] Activating owner user and upgrading to Enterprise plan in database...');
  const ownerUser = await prisma.user.findFirst({ where: { email: ownerEmail } });
  if (!ownerUser) throw new Error('Registered owner user not found in database');
  await prisma.user.update({
    where: { id: ownerUser.id },
    data: { emailVerified: true, status: 'active' },
  });

  const entPlan = await prisma.plan.findFirst({ where: { slug: 'enterprise' } });
  if (!entPlan) throw new Error('Enterprise plan not found in database for upgrade');
  await prisma.subscription.updateMany({
    where: { orgId: ownerUser.orgId },
    data: { planId: entPlan.id },
  });

  const ownerToken = await login(ownerEmail);

  // 2. Fetch System Roles
  console.log('[2/12] Retrieving system roles...');
  const rolesRes = await fetchJson('GET', '/roles', { token: ownerToken });
  const roles = rolesRes.json?.data || [];
  const adminRole = roles.find((r: any) => r.name.toLowerCase() === 'admin');
  const managerRole = roles.find((r: any) => r.name.toLowerCase() === 'manager');
  if (!adminRole || !managerRole)
    throw new Error('System roles (admin/manager) missing from database');

  // 3. Create Branch A and Branch B
  console.log('[3/12] Creating Branch A and Branch B...');
  const branchARes = await fetchJson('POST', '/branches', {
    token: ownerToken,
    body: { name: 'Branch A', timezone: 'UTC' },
  });
  const branchAId = branchARes.json?.data?.id ?? branchARes.json?.id;
  assert.ok(branchAId, 'Failed to create Branch A');

  const branchBRes = await fetchJson('POST', '/branches', {
    token: ownerToken,
    body: { name: 'Branch B', timezone: 'UTC' },
  });
  const branchBId = branchBRes.json?.data?.id ?? branchBRes.json?.id;
  assert.ok(branchBId, 'Failed to create Branch B');

  // 4. Create queues/services for both branches
  console.log('[4/12] Setting up services & multi-step queues for both branches...');
  const svcA = await fetchJson('POST', '/services', {
    token: ownerToken,
    body: {
      name: 'Service A',
      queueEnabled: true,
      appointmentEnabled: false,
      durationMinutes: 15,
      serviceEstimateLowMinutes: 5,
      serviceEstimateHighMinutes: 15,
      branchIds: [branchAId],
    },
  });
  const svcAId = svcA.json?.data?.id ?? svcA.json?.id;
  if (!svcAId) {
    console.log('Service A creation failed response:', JSON.stringify(svcA, null, 2));
  }
  assert.ok(svcAId, 'Failed to create Service A');

  const queueA = await fetchJson('POST', '/queues', {
    token: ownerToken,
    body: {
      branchId: branchAId,
      serviceId: svcAId,
      name: 'Queue A (Multi-step)',
      prefix: 'QA',
      journeyModeOverride: 'visit_multi_step',
      stepRole: 'service',
      callingPolicy: 'fifo',
    },
  });
  const queueAId = queueA.json?.data?.id ?? queueA.json?.id;
  if (!queueAId) {
    console.log('Queue A creation failed response:', JSON.stringify(queueA, null, 2));
  }
  assert.ok(queueAId, 'Failed to create Queue A');

  const svcB = await fetchJson('POST', '/services', {
    token: ownerToken,
    body: {
      name: 'Service B',
      queueEnabled: true,
      appointmentEnabled: false,
      durationMinutes: 15,
      serviceEstimateLowMinutes: 5,
      serviceEstimateHighMinutes: 15,
      branchIds: [branchBId],
    },
  });
  const svcBId = svcB.json?.data?.id ?? svcB.json?.id;
  if (!svcBId) {
    console.log('Service B creation failed response:', JSON.stringify(svcB, null, 2));
  }
  assert.ok(svcBId, 'Failed to create Service B');

  const queueB = await fetchJson('POST', '/queues', {
    token: ownerToken,
    body: {
      branchId: branchBId,
      serviceId: svcBId,
      name: 'Queue B (Multi-step)',
      prefix: 'QB',
      journeyModeOverride: 'visit_multi_step',
      stepRole: 'service',
      callingPolicy: 'fifo',
    },
  });
  const queueBId = queueB.json?.data?.id ?? queueB.json?.id;
  assert.ok(queueBId, 'Failed to create Queue B');

  // 5. Invite actors (Branch Admins & Branch Managers)
  console.log('[5/12] Inviting branch-scoped users...');

  // invite admin for branch A
  const invAdminA = await fetchJson('POST', '/users/invite', {
    token: ownerToken,
    body: {
      email: adminAEmail,
      firstName: 'Admin',
      lastName: 'Branch A',
      roleId: adminRole.id,
      password: PASSWORD,
      branchIds: [branchAId],
    },
  });
  const adminAUserId = invAdminA.json?.data?.id ?? invAdminA.json?.id;
  assert.ok(adminAUserId, 'Failed to invite Admin Branch A');

  // invite admin for branch B
  const invAdminB = await fetchJson('POST', '/users/invite', {
    token: ownerToken,
    body: {
      email: adminBEmail,
      firstName: 'Admin',
      lastName: 'Branch B',
      roleId: adminRole.id,
      password: PASSWORD,
      branchIds: [branchBId],
    },
  });
  const adminBUserId = invAdminB.json?.data?.id ?? invAdminB.json?.id;

  // invite manager for branch A
  const invManagerA = await fetchJson('POST', '/users/invite', {
    token: ownerToken,
    body: {
      email: managerAEmail,
      firstName: 'Manager',
      lastName: 'Branch A',
      roleId: managerRole.id,
      password: PASSWORD,
      branchIds: [branchAId],
    },
  });
  const managerAUserId = invManagerA.json?.data?.id ?? invManagerA.json?.id;

  // Activate them in the database & manually update admin role assignments to be branch-scoped
  await prisma.user.updateMany({
    where: { id: { in: [adminAUserId, adminBUserId, managerAUserId] } },
    data: { emailVerified: true, status: 'active' },
  });

  await prisma.roleAssignment.updateMany({
    where: { userId: adminAUserId },
    data: { branchId: branchAId },
  });

  await prisma.roleAssignment.updateMany({
    where: { userId: adminBUserId },
    data: { branchId: branchBId },
  });

  const adminAssignments = await prisma.roleAssignment.findMany({
    where: { userId: adminAUserId },
    include: { role: true },
  });
  console.log('Admin A Assignments in DB:', JSON.stringify(adminAssignments, null, 2));

  const tokenAdminA = await login(adminAEmail);
  const tokenAdminB = await login(adminBEmail);
  const tokenManagerA = await login(managerAEmail);

  // 6. Test Case 1: Branch A admin can successfully create a flow template for Branch A
  console.log(
    '[6/12] [Test Case 1] Verifying Branch A Admin can create flow template for Branch A...',
  );
  const createRes = await fetchJson('POST', '/flow-templates', {
    token: tokenAdminA,
    body: {
      branchId: branchAId,
      name: 'Branch A Multi-step Flow',
      steps: [
        {
          stepIndex: 1,
          serviceId: svcAId,
          queueId: queueAId,
          stepRole: 'service',
          callingPolicy: 'fifo',
        },
      ],
    },
  });
  assert.strictEqual(
    createRes.status,
    201,
    `Branch A admin should create flow: ${JSON.stringify(createRes.json)}`,
  );
  const flowAId = createRes.json?.data?.id ?? createRes.json?.id;
  assert.ok(flowAId, 'Flow template creation response missing template ID');
  console.log('  ✓ Created flow template successfully (Status 201)');

  // 7. Test Case 2: Branch A admin is DENIED from creating a flow template for Branch B
  console.log(
    '[7/12] [Test Case 2] Verifying Branch A Admin is forbidden from creating flow for Branch B...',
  );
  const tryCreateB = await fetchJson('POST', '/flow-templates', {
    token: tokenAdminA,
    body: {
      branchId: branchBId,
      name: 'Branch B Flow attempted by Admin A',
      steps: [
        {
          stepIndex: 1,
          serviceId: svcBId,
          queueId: queueBId,
          stepRole: 'service',
          callingPolicy: 'fifo',
        },
      ],
    },
  });
  assert.strictEqual(
    tryCreateB.status,
    403,
    'Should restrict branch-scoped admin from creating flow for other branch',
  );
  console.log('  ✓ Correctly returned 403 Forbidden');

  // 8. Test Case 3: Branch A admin is DENIED from creating a flow for Branch A containing queues from Branch B
  console.log(
    '[8/12] [Test Case 3] Verifying Branch A Admin cannot include queues/services of other branches...',
  );
  const tryCrossBranch = await fetchJson('POST', '/flow-templates', {
    token: tokenAdminA,
    body: {
      branchId: branchAId,
      name: 'Invalid Cross Branch Flow',
      steps: [
        {
          stepIndex: 1,
          serviceId: svcBId, // From branch B!
          queueId: queueBId, // From branch B!
          stepRole: 'service',
          callingPolicy: 'fifo',
        },
      ],
    },
  });
  assert.strictEqual(
    tryCrossBranch.status,
    400,
    'Should return 400 Bad Request on service/queue branch mismatch',
  );
  console.log('  ✓ Correctly returned 400 Bad Request');

  // 9. Test Case 4: Branch Managers are DENIED flow template access
  console.log(
    '[9/12] [Test Case 4] Verifying branch manager is forbidden from flow template creation...',
  );
  const tryManager = await fetchJson('POST', '/flow-templates', {
    token: tokenManagerA,
    body: {
      branchId: branchAId,
      name: 'Manager Attempted Flow',
      steps: [
        {
          stepIndex: 1,
          serviceId: svcAId,
          queueId: queueAId,
          stepRole: 'service',
          callingPolicy: 'fifo',
        },
      ],
    },
  });
  assert.strictEqual(
    tryManager.status,
    403,
    'Managers should be strictly forbidden from managing flows',
  );
  console.log('  ✓ Correctly returned 403 Forbidden');

  // 10. Test Case 5: List permissions scoping
  console.log('[10/12] [Test Case 5] Verifying branch list permissions & scoping...');

  // admin-a lists branch A (success)
  const listARes = await fetchJson('GET', `/flow-templates?branchId=${branchAId}`, {
    token: tokenAdminA,
  });
  assert.strictEqual(listARes.status, 200);
  assert.strictEqual(listARes.json?.data?.length, 1);

  // admin-a tries to list branch B (forbidden)
  const listBRes = await fetchJson('GET', `/flow-templates?branchId=${branchBId}`, {
    token: tokenAdminA,
  });
  assert.strictEqual(
    listBRes.status,
    403,
    'Admin A should not be allowed to list Branch B flow templates',
  );
  console.log('  ✓ List permissions correctly scoped and isolated');

  // 11. Test Case 6: Scoped updating and activation
  console.log('[11/12] [Test Case 6] Verifying flow update, activation and scoping...');

  // Admin A updates flow A (success)
  const updateRes = await fetchJson('PATCH', `/flow-templates/${flowAId}`, {
    token: tokenAdminA,
    body: { name: 'Updated Flow A name' },
  });
  assert.strictEqual(updateRes.status, 200);
  assert.strictEqual(updateRes.json?.data?.name, 'Updated Flow A name');

  // Admin A activates flow A (success)
  const activateRes = await fetchJson('POST', `/flow-templates/${flowAId}/activate`, {
    token: tokenAdminA,
  });
  assert.strictEqual(activateRes.status, 201);

  // Admin B attempts to activate flow A (forbidden)
  const tryActivateByB = await fetchJson('POST', `/flow-templates/${flowAId}/activate`, {
    token: tokenAdminB,
  });
  assert.strictEqual(
    tryActivateByB.status,
    403,
    'Admin B should not be allowed to activate Branch A flow',
  );

  // Admin B attempts to update flow A (forbidden)
  const tryUpdateByB = await fetchJson('PATCH', `/flow-templates/${flowAId}`, {
    token: tokenAdminB,
    body: { name: 'Compromised Name' },
  });
  assert.strictEqual(
    tryUpdateByB.status,
    403,
    'Admin B should not be allowed to update Branch A flow',
  );
  console.log('  ✓ Scoped updates and activations correctly validated');

  // 12. Test Case 7: Scoped deletion
  console.log('[12/12] [Test Case 7] Verifying flow deletion scoping...');

  // Admin B attempts to delete flow A (forbidden)
  const tryDeleteByB = await fetchJson('DELETE', `/flow-templates/${flowAId}`, {
    token: tokenAdminB,
  });
  assert.strictEqual(
    tryDeleteByB.status,
    403,
    'Admin B should not be allowed to delete Branch A flow',
  );

  // Admin A deletes flow A (success)
  const deleteRes = await fetchJson('DELETE', `/flow-templates/${flowAId}`, { token: tokenAdminA });
  assert.strictEqual(deleteRes.status, 200, 'Admin A should delete Branch A flow successfully');
  console.log('  ✓ Deletion scoping correctly validated');

  console.log('\n🎉 ALL BRANCH ISOLATION FLOW TEMPLATE PERMISSION CHECKS PASSED SUCCESSFULLY!');
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
