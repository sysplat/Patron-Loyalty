import { PrismaClient } from '@prisma/client';

const API_BASE = 'http://localhost:4000/api/v1';
const prisma = new PrismaClient();

async function fetchJson(method, path, { token, body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { _raw: text };
  }
  return { ok: res.ok, status: res.status, json };
}

async function runTest() {
  const stamp = Date.now();
  const email = `test.owner.${stamp}@example.com`;
  const password = 'Password123!';

  console.log(`\n🚀 Testing User Branch Defaults (Comprehensive CLI)`);
  console.log(`--------------------------------------------------`);

  // 1. Register Owner
  console.log(`[1/5] Registering Owner: ${email}`);
  const reg = await fetchJson('POST', '/auth/register', {
    body: { businessName: `Test Org ${stamp}`, firstName: 'Admin', lastName: 'Owner', email, password, acceptLegal: true }
  });
  if (!reg.ok) throw new Error(`Registration failed: ${JSON.stringify(reg.json)}`);

  // 1.5 Bypass verification via Prisma
  console.log(`[1.5/5] Bypassing verification via DB...`);
  await prisma.user.update({
    where: { email },
    data: { emailVerifiedAt: new Date(), status: 'active' }
  });

  // 2. Login
  console.log(`[2/5] Logging in...`);
  const login = await fetchJson('POST', '/auth/login', { body: { email, password } });
  const token = login.json?.data?.tokens?.accessToken;
  if (!token) throw new Error(`Login failed: ${JSON.stringify(login.json)}`);

  // 3. Get Roles
  console.log(`[3/5] Fetching roles...`);
  const rolesRes = await fetchJson('GET', '/roles', { token });
  const roles = rolesRes.json?.data || [];
  const staffRole = roles.find(r => r.name.toLowerCase() === 'staff');
  if (!staffRole) throw new Error('Staff role not found');

  // 4. Invite User without branches
  console.log(`[4/5] Inviting Staff member with EMPTY branch list...`);
  const memberEmail = `test.staff.${stamp}@example.com`;
  const invite = await fetchJson('POST', '/users/invite', {
    token,
    body: {
      email: memberEmail,
      firstName: 'Staff',
      lastName: 'User',
      roleId: staffRole.id,
      password: 'Password123!',
      branchIds: [] // Explicitly empty
    }
  });

  if (!invite.ok) {
     throw new Error(`Invite failed: ${JSON.stringify(invite.json)}`);
  }
  
  const memberId = invite.json?.data?.id || invite.json?.id;
  console.log(`✅ User invited successfully (ID: ${memberId})`);
  
  // 5. Verify assignments
  console.log(`[5/5] Verifying role assignments...`);
  const userDetail = await fetchJson('GET', `/users/${memberId}`, { token });
  const assignments = userDetail.json?.data?.roleAssignments || userDetail.json?.roleAssignments || [];
  
  console.log(`Current Assignments count: ${assignments.length}`);
  
  // Per UserService.invite, if no branches provided for Staff, it creates 1 assignment with branchId: null
  const hasNullBranch = assignments.some(a => a.branchId === null);
  if (hasNullBranch && assignments.length === 1) {
    console.log(`✅ SUCCESS: Staff user created with NULL branch (no auto-assignment to all branches).`);
  } else {
    console.log(`❌ FAILURE: Staff user has unexpected assignments!`);
    console.log(JSON.stringify(assignments, null, 2));
    process.exit(1);
  }

  console.log(`\n🎉 Comprehensive API Test Passed!`);
}

runTest()
  .catch(err => {
    console.error(`\n❌ TEST FAILED`);
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
