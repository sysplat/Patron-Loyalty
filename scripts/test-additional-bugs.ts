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
  const ownerEmail = `smoke.bugs.owner+${stamp}@example.com`;
  const adminAEmail = `smoke.bugs.admina+${stamp}@example.com`;
  const adminBEmail = `smoke.bugs.adminb+${stamp}@example.com`;
  const staffAEmail = `smoke.bugs.staffa+${stamp}@example.com`;
  const staffBEmail = `smoke.bugs.staffb+${stamp}@example.com`;

  console.log(`🚀 Running Additional Bugs Integration Test Suite (Issues 7 & 8)`);
  console.log(`API Base: ${API_BASE}`);
  console.log('----------------------------------------------------------------');

  // 1. Register Owner and upgrade
  console.log('[1/7] Registering owner and upgrading organization to Enterprise...');
  const reg = await fetchJson('POST', '/auth/register', {
    body: {
      businessName: `Bugs Org ${stamp}`,
      email: ownerEmail,
      password: PASSWORD,
      firstName: 'Owner',
      lastName: 'Bugs',
      acceptLegal: true,
    },
  });
  assert.ok(
    reg.status === 200 || reg.status === 201,
    `Failed to register owner: ${JSON.stringify(reg.json)}`,
  );

  const ownerUser = await prisma.user.findFirst({ where: { email: ownerEmail } });
  if (!ownerUser) throw new Error('Registered owner user not found in DB');
  await prisma.user.update({
    where: { id: ownerUser.id },
    data: { emailVerified: true, status: 'active' },
  });

  const entPlan = await prisma.plan.findFirst({ where: { slug: 'enterprise' } });
  if (!entPlan) throw new Error('Enterprise plan not found');
  await prisma.subscription.updateMany({
    where: { orgId: ownerUser.orgId },
    data: { planId: entPlan.id },
  });

  const ownerToken = await login(ownerEmail);

  // 2. Fetch System Roles
  console.log('[2/7] Retrieving system roles...');
  const rolesRes = await fetchJson('GET', '/roles', { token: ownerToken });
  const roles = rolesRes.json?.data || [];
  const adminRole = roles.find((r: any) => r.name.toLowerCase() === 'admin');
  const staffRole = roles.find((r: any) => r.name.toLowerCase() === 'staff');
  if (!adminRole || !staffRole) throw new Error('System roles (admin/staff) missing');

  // 3. Create Branches, Services & Queues
  console.log('[3/7] Setting up Branch A and Branch B...');
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

  // Configure Service and Queue for Branch A (to support flow template creation)
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
  assert.ok(svcAId, 'Failed to create Service A');

  const queueA = await fetchJson('POST', '/queues', {
    token: ownerToken,
    body: {
      branchId: branchAId,
      serviceId: svcAId,
      name: 'Queue A',
      prefix: 'QA',
      journeyModeOverride: 'visit_multi_step',
      stepRole: 'service',
      callingPolicy: 'fifo',
    },
  });
  const queueAId = queueA.json?.data?.id ?? queueA.json?.id;
  assert.ok(queueAId, 'Failed to create Queue A');

  // Create a counter desk desk-5 in Branch A
  const deskARes = await fetchJson('POST', '/desks', {
    token: ownerToken,
    body: { branchId: branchAId, number: '5', name: 'Counter 5' },
  });
  assert.ok(deskARes.ok, `Failed to create desk-5: ${JSON.stringify(deskARes.json)}`);

  const deskA6Res = await fetchJson('POST', '/desks', {
    token: ownerToken,
    body: { branchId: branchAId, number: '6', name: 'Counter 6' },
  });
  assert.ok(deskA6Res.ok, `Failed to create desk-6: ${JSON.stringify(deskA6Res.json)}`);

  // 4. Invite Actors
  console.log('[4/7] Inviting branch admins and staff...');

  // invite Admin A
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
  assert.ok(adminAUserId, 'Failed to invite Admin A');

  // invite Admin B
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

  // invite Staff A
  const invStaffA = await fetchJson('POST', '/users/invite', {
    token: ownerToken,
    body: {
      email: staffAEmail,
      firstName: 'Staff',
      lastName: 'A',
      roleId: staffRole.id,
      password: PASSWORD,
      branchIds: [branchAId],
    },
  });
  const staffAUserId = invStaffA.json?.data?.id ?? invStaffA.json?.id;

  // invite Staff B
  const invStaffB = await fetchJson('POST', '/users/invite', {
    token: ownerToken,
    body: {
      email: staffBEmail,
      firstName: 'Staff',
      lastName: 'B',
      roleId: staffRole.id,
      password: PASSWORD,
      branchIds: [branchAId],
    },
  });
  const staffBUserId = invStaffB.json?.data?.id ?? invStaffB.json?.id;

  // Activate and set branch scoping in DB
  await prisma.user.updateMany({
    where: { id: { in: [adminAUserId, adminBUserId, staffAUserId, staffBUserId] } },
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
  await prisma.roleAssignment.updateMany({
    where: { userId: staffAUserId },
    data: { branchId: branchAId },
  });
  await prisma.roleAssignment.updateMany({
    where: { userId: staffBUserId },
    data: { branchId: branchAId },
  });

  const tokenAdminA = await login(adminAEmail);
  const tokenAdminB = await login(adminBEmail);
  const tokenStaffA = await login(staffAEmail);
  const tokenStaffB = await login(staffBEmail);

  // 5. Test Case 1: Issue #8 — RbacGuard Flow Template Branch Isolation fallback
  console.log('[5/7] [Test Case 1] Verifying RbacGuard Flow Template Branch Isolation fallback...');

  // Create flow template A as Admin A
  const createFlowRes = await fetchJson('POST', '/flow-templates', {
    token: tokenAdminA,
    body: {
      branchId: branchAId,
      name: 'Flow Branch A',
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
  assert.strictEqual(createFlowRes.status, 201);
  const flowId = createFlowRes.json?.data?.id ?? createFlowRes.json?.id;
  assert.ok(flowId);

  // Admin B (Branch B scoped) attempts to update/PATCH Flow A (Branch A scoped)
  const patchRes = await fetchJson('PATCH', `/flow-templates/${flowId}`, {
    token: tokenAdminB,
    body: { name: 'Compromised Flow' },
  });
  console.log(`  PATCH status: ${patchRes.status}, message: ${JSON.stringify(patchRes.json)}`);
  // With RbacGuard correctly resolving flow template branches, it must return 403 Forbidden!
  assert.strictEqual(patchRes.status, 403);

  // Admin B (Branch B scoped) attempts to activate Flow A
  const activateRes = await fetchJson('POST', `/flow-templates/${flowId}/activate`, {
    token: tokenAdminB,
  });
  console.log(
    `  Activate status: ${activateRes.status}, message: ${JSON.stringify(activateRes.json)}`,
  );
  assert.strictEqual(activateRes.status, 403);

  // Admin B (Branch B scoped) attempts to delete Flow A
  const deleteRes = await fetchJson('DELETE', `/flow-templates/${flowId}`, { token: tokenAdminB });
  console.log(`  Delete status: ${deleteRes.status}, message: ${JSON.stringify(deleteRes.json)}`);
  assert.strictEqual(deleteRes.status, 403);

  console.log(
    '  ✓ RbacGuard successfully isolated and blocked cross-branch flow edits with 403 Forbidden',
  );

  // Activate Flow A as Admin A to support workbench session creation
  console.log('  Activating Flow A as Admin A...');
  const actSuccess = await fetchJson('POST', `/flow-templates/${flowId}/activate`, {
    token: tokenAdminA,
  });
  assert.strictEqual(
    actSuccess.status,
    201,
    `Failed to activate Flow A: ${JSON.stringify(actSuccess.json)}`,
  );

  // 6. Test Case 2: Issue #7 — Desk Session Takeover / Sharing Isolation
  console.log('[6/7] [Test Case 2] Verifying Desk Session Takeover...');

  // Resolve station profile ID for Staff A & B (automatically created by serve context resolution)
  const profileRes = await fetchJson(
    'GET',
    `/workbench?branchId=${branchAId}&deskNumber=5&forJourney=true`,
    {
      token: tokenStaffA,
    },
  );
  const profileId =
    profileRes.json?.data?.session?.stationProfileId ?? profileRes.json?.session?.stationProfileId;
  assert.ok(profileId, `Failed to get station profile ID: ${JSON.stringify(profileRes.json)}`);

  // Staff A signs into Counter 5
  console.log('  Staff A signing in to Counter 5...');
  const sessionARes = await fetchJson('POST', '/workbench/session', {
    token: tokenStaffA,
    body: { branchId: branchAId, deskNumber: '5', stationProfileId: profileId },
  });
  assert.strictEqual(sessionARes.status, 200);
  const sessionAId = sessionARes.json?.data?.sessionId ?? sessionARes.json?.sessionId;
  assert.ok(sessionAId);

  // Assert session A is active
  const activeA1 = await prisma.agentSession.findUnique({ where: { id: sessionAId } });
  assert.ok(activeA1 && activeA1.endedAt === null, 'Session A must be active');

  // Staff B signs into Counter 5 (takeover!)
  console.log('  Staff B signing in to Counter 5 (taking over!)...');
  const sessionBRes = await fetchJson('POST', '/workbench/session', {
    token: tokenStaffB,
    body: { branchId: branchAId, deskNumber: '5', stationProfileId: profileId },
  });
  assert.strictEqual(sessionBRes.status, 200);
  const sessionBId = sessionBRes.json?.data?.sessionId ?? sessionBRes.json?.sessionId;
  assert.ok(sessionBId);

  // Assert session B is active
  const activeB = await prisma.agentSession.findUnique({ where: { id: sessionBId } });
  assert.ok(activeB && activeB.endedAt === null, 'Session B must be active');

  // Assert session A is now TERMINATED
  const activeA2 = await prisma.agentSession.findUnique({ where: { id: sessionAId } });
  console.log(`  Staff A Session EndedAt: ${activeA2?.endedAt}`);
  assert.ok(
    activeA2 && activeA2.endedAt !== null,
    'Session A must be deactivated after Staff B signs in to Counter 5',
  );
  console.log('  ✓ Staff A session deactivated automatically upon Counter 5 takeover by Staff B');

  // 7. Verify non-conflicting logins at different counters
  console.log('[7/9] Verifying non-conflicting logins at different counters...');

  // Staff A signs into Counter 6
  console.log('  Staff A signing in to Counter 6...');
  const sessionA6Res = await fetchJson('POST', '/workbench/session', {
    token: tokenStaffA,
    body: { branchId: branchAId, deskNumber: '6', stationProfileId: profileId },
  });
  assert.strictEqual(sessionA6Res.status, 200);
  const sessionA6Id = sessionA6Res.json?.data?.sessionId ?? sessionA6Res.json?.sessionId;
  assert.ok(sessionA6Id);

  // Assert both session B (Counter 5) and session A6 (Counter 6) are active
  const checkB = await prisma.agentSession.findUnique({ where: { id: sessionBId } });
  const checkA6 = await prisma.agentSession.findUnique({ where: { id: sessionA6Id } });
  assert.ok(checkB && checkB.endedAt === null, 'Session B at Counter 5 should still be active');
  assert.ok(checkA6 && checkA6.endedAt === null, 'Session A6 at Counter 6 should be active');
  console.log('  ✓ Sessions at different counters did not conflict and remain active');

  // 8. Test Case 3: Flow template routes access control validation (without OrgOwnerOrAdminGuard)
  console.log('[8/9] [Test Case 3] Verifying Flow Template Controller access control...');

  // Staff A (who doesn't have permissions to manage templates) attempts to list templates
  const listTemplatesStaff = await fetchJson('GET', `/flow-templates?branchId=${branchAId}`, {
    token: tokenStaffA,
  });
  console.log(`  Staff template list status: ${listTemplatesStaff.status}`);
  assert.strictEqual(
    listTemplatesStaff.status,
    403,
    'Staff should be forbidden from listing templates',
  );

  // Admin A (who has permissions and is scoped to branch A) lists templates successfully
  const listTemplatesAdmin = await fetchJson('GET', `/flow-templates?branchId=${branchAId}`, {
    token: tokenAdminA,
  });
  console.log(`  Admin template list status: ${listTemplatesAdmin.status}`);
  assert.strictEqual(listTemplatesAdmin.status, 200, 'Admin A should be allowed to list templates');
  const templateList = listTemplatesAdmin.json?.data || [];
  assert.ok(templateList.length > 0, 'Template list should contain the created template');
  console.log(
    '  ✓ RbacGuard correctly secures the flow template controller endpoints even without OrgOwnerOrAdminGuard',
  );

  // 9. Test Case 4: Graceful Wait Times Degradation and Dynamic Estimation
  console.log('[9/9] [Test Case 4] Verifying wait times estimation pipeline...');

  // 9.1 Set up Service B and Queue B without estimate configurations
  const svcB = await fetchJson('POST', '/services', {
    token: ownerToken,
    body: {
      name: 'Service B',
      queueEnabled: true,
      appointmentEnabled: false,
      durationMinutes: 15,
      serviceEstimateLowMinutes: 5,
      serviceEstimateHighMinutes: 15,
      branchIds: [branchAId],
    },
  });
  const svcBId = svcB.json?.data?.id ?? svcB.json?.id;
  assert.ok(svcBId, 'Failed to create Service B');

  // Bypassing API-level validation to test graceful degradation of wait times when estimates are missing
  await prisma.service.update({
    where: { id: svcBId },
    data: {
      serviceEstimateLowMinutes: null,
      serviceEstimateHighMinutes: null,
    },
  });

  const queueB = await fetchJson('POST', '/queues', {
    token: ownerToken,
    body: {
      branchId: branchAId,
      serviceId: svcBId,
      name: 'Queue B',
      prefix: 'QB',
      journeyModeOverride: 'visit_multi_step',
      stepRole: 'service',
      callingPolicy: 'fifo',
    },
  });
  const queueBId = queueB.json?.data?.id ?? queueB.json?.id;
  assert.ok(queueBId, 'Failed to create Queue B');

  // Open Queue B
  console.log('  Opening Queue B...');
  const openQueueB = await fetchJson('POST', `/queues/${queueBId}/open`, { token: ownerToken });
  assert.strictEqual(
    openQueueB.status,
    200,
    `Failed to open Queue B: ${JSON.stringify(openQueueB.json)}`,
  );

  // Issue ticket in Queue B
  console.log('  Issuing a ticket in Queue B (no wait estimates configured)...');
  const ticketB1 = await fetchJson('POST', '/tickets/issue', {
    token: ownerToken,
    body: {
      queueId: queueBId,
      branchId: branchAId,
      serviceId: svcBId,
      customerPhone: '+15555550100',
      source: 'kiosk',
    },
  });
  if (ticketB1.status !== 201) {
    throw new Error(
      `Failed to issue ticket B1: Status ${ticketB1.status}, body: ${JSON.stringify(ticketB1.json)}`,
    );
  }
  const ticketB1Id = ticketB1.json?.data?.id ?? ticketB1.json?.id;
  assert.ok(ticketB1Id);

  // Call track endpoint and assert estimates are undefined/null
  const trackB1 = await fetchJson('GET', `/tickets/${ticketB1Id}/track`);
  assert.strictEqual(trackB1.status, 200);
  const estLow = trackB1.json?.estimatedWaitMins;
  const estHigh = trackB1.json?.estimatedWaitMax;
  console.log(`  Calculated estimates when missing: low=${estLow}, high=${estHigh}`);
  assert.ok(
    estLow === undefined || estLow === null,
    'Estimated low minutes should be undefined or null',
  );
  assert.ok(
    estHigh === undefined || estHigh === null,
    'Estimated high minutes should be undefined or null',
  );
  console.log('  ✓ Estimates degraded gracefully when service wait configuration was absent');

  // 9.2 Update Service B with custom estimates and check dynamic calculation
  console.log('  Updating Service B with custom wait estimates (low=10, high=25)...');
  const updateSvcB = await fetchJson('PATCH', `/services/${svcBId}`, {
    token: ownerToken,
    body: {
      serviceEstimateLowMinutes: 10,
      serviceEstimateHighMinutes: 25,
    },
  });
  assert.strictEqual(updateSvcB.status, 200);

  // Issue a second ticket in Queue B (so position is 2, peopleAhead = 1, capacity = 1)
  console.log('  Issuing a second ticket in Queue B...');
  const ticketB2 = await fetchJson('POST', '/tickets/issue', {
    token: ownerToken,
    body: {
      queueId: queueBId,
      branchId: branchAId,
      serviceId: svcBId,
      customerPhone: '+15555550200',
      source: 'kiosk',
    },
  });
  assert.strictEqual(ticketB2.status, 201);
  const ticketB2Id = ticketB2.json?.data?.id ?? ticketB2.json?.id;
  assert.ok(ticketB2Id);

  // Wait 1.5s for redis caches to expire if necessary or call track directly
  const trackB2 = await fetchJson('GET', `/tickets/${ticketB2Id}/track`);
  assert.strictEqual(trackB2.status, 200);
  const newEstLow = trackB2.json?.estimatedWaitMins;
  const newEstHigh = trackB2.json?.estimatedWaitMax;
  console.log(
    `  Calculated estimates after configuration: position=${trackB2.json?.position}, low=${newEstLow}, high=${newEstHigh}`,
  );

  // With capacity = 1, position = 2 (peopleAhead = 1), estimatedWaitMins should be:
  // rounds = Math.ceil(1 / 1) = 1
  // low = 1 * 10 = 10, high = 1 * 25 = 25
  assert.strictEqual(newEstLow, 10, 'Dynamic low wait time estimate mismatch');
  assert.strictEqual(newEstHigh, 25, 'Dynamic high wait time estimate mismatch');
  console.log(
    '  ✓ Wait times calculated dynamically and correctly based on queue position and capacity',
  );

  console.log('\n🎉 ALL ADDITIONAL & TECH DEBT BUG FIX VERIFICATION CHECKS PASSED SUCCESSFULLY!');
}

main()
  .catch((err) => {
    console.error('\n❌ ADDITIONAL BUG TESTS FAILED');
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
