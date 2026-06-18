#!/usr/bin/env node
/**
 * Smoke: branch-scoped timezone across RBAC roles.
 * Creates two branches in different IANA zones and verifies API responses per role.
 */
const API_BASE = (process.env.API_BASE || 'http://localhost:4000/api/v1').replace(/\/$/, '');
const password = process.env.SMOKE_PASSWORD || 'SmokeTz@2026!';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

async function login(email) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await fetchJson('POST', '/auth/login', {
      body: { email: email.toLowerCase(), password },
    });
    if (r.status === 429) {
      await sleep(attempt === 1 ? 65000 : 15000);
      continue;
    }
    if (r.status !== 200) throw new Error(`login ${email}: ${r.status} ${JSON.stringify(r.json)}`);
    const access = r.json?.data?.tokens?.accessToken;
    if (!access) throw new Error(`login ${email}: missing token`);
    return access;
  }
  throw new Error(`login rate-limited: ${email}`);
}

function unwrap(json) {
  return json?.data ?? json;
}

function responseMeta(json) {
  return json?.meta ?? null;
}

const results = [];

function record(role, check, pass, detail) {
  results.push({ role, check, pass, detail });
  const icon = pass ? '✓' : '✗';
  console.log(`  ${icon} ${check}${detail ? `: ${detail}` : ''}`);
}

async function main() {
  const stamp = Date.now();
  const ownerEmail = `smoke.tz.owner+${stamp}@example.com`.toLowerCase();
  const memberEmail = `smoke.tz.member+${stamp}@example.com`.toLowerCase();

  console.log(`API_BASE=${API_BASE}\n`);

  const health = await fetchJson('GET', '/health');
  if (health.status !== 200) throw new Error('/health failed');

  const reg = await fetchJson('POST', '/auth/register', {
    body: {
      businessName: `Smoke TZ ${stamp}`,
      firstName: 'TZ',
      lastName: 'Owner',
      email: ownerEmail,
      password,
      acceptLegal: true,
    },
  });
  if (![200, 201].includes(reg.status)) throw new Error('register failed');

  await sleep(400);
  const ownerToken = await login(ownerEmail);

  await fetchJson('PATCH', '/organization', {
    token: ownerToken,
    body: { timezone: 'America/Vancouver' },
  });

  async function createBranch(name, timezone) {
    const r = await fetchJson('POST', '/branches', {
      token: ownerToken,
      body: { name, timezone },
    });
    if (![200, 201].includes(r.status)) throw new Error(`branch ${name}: ${r.status}`);
    return unwrap(r.json).id;
  }

  async function setupQueue(branchId, label) {
    const svc = await fetchJson('POST', '/services', {
      token: ownerToken,
      body: {
        name: `Svc ${label} ${stamp}`,
        queueEnabled: true,
        appointmentEnabled: false,
        durationMinutes: 10,
        serviceEstimateLowMinutes: 5,
        serviceEstimateHighMinutes: 15,
        branchIds: [branchId],
      },
    });
    if (![200, 201].includes(svc.status)) {
      throw new Error(`service ${label}: ${svc.status} ${JSON.stringify(unwrap(svc.json))}`);
    }
    const serviceId = unwrap(svc.json).id;
    const q = await fetchJson('POST', '/queues', {
      token: ownerToken,
      body: {
        branchId,
        serviceId,
        name: `Q ${label} ${stamp}`,
        prefix: `${label}${String(stamp).slice(-3)}`,
      },
    });
    if (![200, 201].includes(q.status)) {
      throw new Error(`queue ${label}: ${q.status} ${JSON.stringify(unwrap(q.json))}`);
    }
    const queueId = unwrap(q.json).id;
    await fetchJson('POST', `/queues/${queueId}/open`, { token: ownerToken });
    return queueId;
  }

  const branchEastId = await createBranch(`East ${stamp}`, 'America/New_York');
  let branchWestId = null;
  let queueWestId = null;
  const westBranchRes = await fetchJson('POST', '/branches', {
    token: ownerToken,
    body: { name: `West ${stamp}`, timezone: 'America/Los_Angeles' },
  });
  if ([200, 201].includes(westBranchRes.status)) {
    branchWestId = unwrap(westBranchRes.json).id;
    console.log('  (two-branch setup — plan allows multiple branches)');
  } else if (westBranchRes.status === 403) {
    console.log('  (single-branch setup — free plan maxBranches=1; skipping West branch checks)');
  } else {
    throw new Error(`branch West: ${westBranchRes.status}`);
  }

  const queueEastId = await setupQueue(branchEastId, 'E');
  if (branchWestId) {
    queueWestId = await setupQueue(branchWestId, 'W');
  }

  const rolesRes = await fetchJson('GET', '/roles', { token: ownerToken });
  const roleIds = Object.fromEntries((unwrap(rolesRes.json) || []).map((r) => [r.name, r.id]));

  const inv = await fetchJson('POST', '/users/invite', {
    token: ownerToken,
    body: {
      email: memberEmail,
      firstName: 'TZ',
      lastName: 'Member',
      roleId: roleIds.admin,
      password,
    },
  });
  const memberPayload = unwrap(inv.json);
  const memberUserId = memberPayload?.id;
  const inviteToken = memberPayload?.inviteToken;
  if (inviteToken) {
    await fetchJson('POST', '/auth/reset-password', { body: { token: inviteToken, password } });
  }

  async function assignRole(roleName, branchId) {
    const ud = await fetchJson('GET', `/users/${memberUserId}`, { token: ownerToken });
    const assignmentId = unwrap(ud.json)?.roleAssignments?.[0]?.id;
    if (assignmentId) {
      await fetchJson('DELETE', `/roles/assignments/${assignmentId}`, { token: ownerToken });
    }
    await fetchJson('POST', '/roles/assign', {
      token: ownerToken,
      body: {
        userId: memberUserId,
        roleId: roleIds[roleName],
        ...(['manager', 'staff', 'viewer'].includes(roleName) ? { branchId: branchEastId } : {}),
      },
    });
    return login(memberEmail);
  }

  async function testRole(roleName, token, { canReport }) {
    console.log(`\n● ${roleName}`);

    const branchesRes = await fetchJson('GET', '/branches', { token });
    const branches = unwrap(branchesRes.json) || [];
    const east = branches.find((b) => b.id === branchEastId);
    const west = branches.find((b) => b.id === branchWestId);
    record(roleName, 'GET /branches includes East timezone', east?.timezone === 'America/New_York', east?.timezone);
    record(
      roleName,
      'GET /branches scope for West branch',
      branchWestId
        ? roleName === 'owner' || roleName === 'admin'
          ? !!west
          : !west
        : true,
      branchWestId ? (west ? `visible (${west.timezone})` : 'hidden') : 'n/a (single branch org)',
    );

    const ticketsEast = await fetchJson(
      'GET',
      `/tickets?period=today&queueId=${encodeURIComponent(queueEastId)}`,
      { token },
    );
    const eastMeta = responseMeta(ticketsEast.json);
    record(
      roleName,
      'GET /tickets?period=today uses East branch TZ',
      ticketsEast.status === 200 && eastMeta?.timezone === 'America/New_York',
      eastMeta?.timezone ?? `HTTP ${ticketsEast.status}`,
    );

    if (queueWestId) {
      const ticketsWest = await fetchJson(
        'GET',
        `/tickets?period=today&queueId=${encodeURIComponent(queueWestId)}`,
        { token },
      );
      const westMeta = responseMeta(ticketsWest.json);
      const westAllowed = ['owner', 'admin'].includes(roleName);
      record(
        roleName,
        'GET /tickets West queue access',
        westAllowed ? ticketsWest.status === 200 : ticketsWest.status === 403,
        westAllowed ? westMeta?.timezone ?? `HTTP ${ticketsWest.status}` : `HTTP ${ticketsWest.status}`,
      );
      if (westAllowed && ticketsWest.status === 200) {
        record(
          roleName,
          'West queue meta.timezone',
          westMeta?.timezone === 'America/Los_Angeles',
          westMeta?.timezone,
        );
      }
    }

    const overviewOrg = await fetchJson('GET', '/reports/overview?period=today', { token });
    if (canReport) {
      const orgTz = unwrap(overviewOrg.json)?.timezone;
      record(
        roleName,
        'GET /reports/overview org-wide timezone',
        overviewOrg.status === 200 && orgTz === 'America/Vancouver',
        orgTz ?? `HTTP ${overviewOrg.status}`,
      );
    } else {
      record(roleName, 'GET /reports/overview denied', overviewOrg.status === 403, `HTTP ${overviewOrg.status}`);
    }

  const overviewEast = await fetchJson(
      'GET',
      `/reports/overview?period=today&branchId=${encodeURIComponent(branchEastId)}`,
      { token },
    );
    if (canReport) {
      const eastTz = unwrap(overviewEast.json)?.timezone;
      record(
        roleName,
        'GET /reports/overview?branchId=East timezone',
        overviewEast.status === 200 && eastTz === 'America/New_York',
        eastTz ?? `HTTP ${overviewEast.status}`,
      );
    }

    if (branchWestId && canReport && ['owner', 'admin'].includes(roleName)) {
      const overviewWest = await fetchJson(
        'GET',
        `/reports/overview?period=today&branchId=${encodeURIComponent(branchWestId)}`,
        { token },
      );
      const westTz = unwrap(overviewWest.json)?.timezone;
      record(
        roleName,
        'GET /reports/overview?branchId=West timezone',
        overviewWest.status === 200 && westTz === 'America/Los_Angeles',
        westTz ?? `HTTP ${overviewWest.status}`,
      );
    } else if (branchWestId && canReport) {
      const overviewWest = await fetchJson(
        'GET',
        `/reports/overview?period=today&branchId=${encodeURIComponent(branchWestId)}`,
        { token },
      );
      record(
        roleName,
        'GET /reports/overview West branch denied',
        overviewWest.status === 403,
        `HTTP ${overviewWest.status}`,
      );
    }

    const stats = await fetchJson(
      'GET',
      `/tickets/queue/${encodeURIComponent(queueEastId)}/stats?period=today`,
      { token },
    );
    record(roleName, 'GET queue stats (East)', stats.status === 200, `HTTP ${stats.status}`);
  }

  await testRole('owner', ownerToken, { canReport: true });

  for (const role of ['admin', 'manager', 'staff', 'viewer']) {
    const tok = await assignRole(role);
    await testRole(role, tok, { canReport: role !== 'staff' });
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n── Summary: ${results.length - failed.length}/${results.length} passed ──`);
  if (failed.length) {
    console.log('\nFailed checks:');
    for (const f of failed) console.log(`  [${f.role}] ${f.check}${f.detail ? ` (${f.detail})` : ''}`);
    process.exit(1);
  }
  console.log('\nAll role timezone checks passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
