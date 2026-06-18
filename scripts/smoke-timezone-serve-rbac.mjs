#!/usr/bin/env node
/**
 * Smoke: branch timezone on single-step (classic) and multi-step (journey) serve APIs per RBAC role.
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

function record(role, surface, check, pass, detail) {
  results.push({ role, surface, check, pass, detail });
  const icon = pass ? '✓' : '✗';
  console.log(`  ${icon} [${surface}] ${check}${detail ? `: ${detail}` : ''}`);
}

async function main() {
  const stamp = Date.now();
  const ownerEmail = `smoke.serve.tz.owner+${stamp}@example.com`.toLowerCase();
  const memberEmail = `smoke.serve.tz.member+${stamp}@example.com`.toLowerCase();
  const BRANCH_TZ = 'America/New_York';
  const ORG_TZ = 'America/Vancouver';

  console.log(`API_BASE=${API_BASE}\n`);

  const health = await fetchJson('GET', '/health');
  if (health.status !== 200) throw new Error('/health failed');

  const reg = await fetchJson('POST', '/auth/register', {
    body: {
      businessName: `Smoke Serve TZ ${stamp}`,
      firstName: 'Serve',
      lastName: 'Owner',
      email: ownerEmail,
      password,
      acceptLegal: true,
    },
  });
  if (![200, 201].includes(reg.status)) throw new Error('register failed');

  await sleep(400);
  let ownerToken = await login(ownerEmail);

  await fetchJson('PATCH', '/organization', {
    token: ownerToken,
    body: { timezone: ORG_TZ, visitJourneysEnabled: true },
  });

  const branchRes = await fetchJson('POST', '/branches', {
    token: ownerToken,
    body: { name: `Serve Branch ${stamp}`, timezone: BRANCH_TZ },
  });
  if (![200, 201].includes(branchRes.status)) throw new Error(`branch: ${branchRes.status}`);
  const branchId = unwrap(branchRes.json).id;

  const svcRes = await fetchJson('POST', '/services', {
    token: ownerToken,
    body: {
      name: `Svc ${stamp}`,
      queueEnabled: true,
      appointmentEnabled: false,
      durationMinutes: 10,
      serviceEstimateLowMinutes: 5,
      serviceEstimateHighMinutes: 15,
      branchIds: [branchId],
    },
  });
  if (![200, 201].includes(svcRes.status)) throw new Error(`service: ${svcRes.status}`);
  const serviceId = unwrap(svcRes.json).id;

  async function createQueue(body) {
    const r = await fetchJson('POST', '/queues', { token: ownerToken, body: { branchId, serviceId, ...body } });
    if (![200, 201].includes(r.status)) throw new Error(`queue ${body.name}: ${r.status} ${JSON.stringify(r.json)}`);
    const queueId = unwrap(r.json).id;
    await fetchJson('POST', `/queues/${queueId}/open`, { token: ownerToken });
    return queueId;
  }

  const classicQueueId = await createQueue({
    name: `Classic ${stamp}`,
    prefix: `C${String(stamp).slice(-3)}`,
    callingPolicy: 'fifo',
  });

  const journeyServiceQueueId = await createQueue({
    name: `Journey Service ${stamp}`,
    prefix: `J${String(stamp).slice(-3)}`,
    journeyModeOverride: 'visit_multi_step',
    stepRole: 'service',
    callingPolicy: 'manual_only',
  });

  const journeyPickupQueueId = await createQueue({
    name: `Journey Pickup ${stamp}`,
    prefix: `P${String(stamp).slice(-3)}`,
    journeyModeOverride: 'visit_multi_step',
    stepRole: 'pickup',
    callingPolicy: 'ready_then_manual',
  });

  const flowRes = await fetchJson('POST', '/flow-templates', {
    token: ownerToken,
    body: {
      branchId,
      name: `Flow ${stamp}`,
      steps: [
        {
          stepIndex: 1,
          serviceId,
          queueId: journeyServiceQueueId,
          stepRole: 'service',
          callingPolicy: 'manual_only',
        },
        {
          stepIndex: 2,
          serviceId,
          queueId: journeyPickupQueueId,
          stepRole: 'pickup',
          callingPolicy: 'ready_then_manual',
        },
      ],
    },
  });
  if (![200, 201].includes(flowRes.status)) throw new Error(`flow: ${flowRes.status}`);
  const flowId = unwrap(flowRes.json).id;
  await fetchJson('POST', `/flow-templates/${flowId}/activate`, { token: ownerToken });

  const deskRes = await fetchJson('POST', '/desks', {
    token: ownerToken,
    body: { branchId, name: `Counter ${stamp}`, number: '1' },
  });
  if (![200, 201].includes(deskRes.status)) throw new Error(`desk: ${deskRes.status}`);
  const deskNumber = String(unwrap(deskRes.json).number ?? '1');
  await fetchJson('PATCH', `/desks/${unwrap(deskRes.json).id}`, {
    token: ownerToken,
    body: { status: 'open' },
  });

  const jwtOrgId = JSON.parse(Buffer.from(ownerToken.split('.')[1], 'base64url').toString()).orgId;

  const classicIssue = await fetchJson('POST', '/tickets/issue', {
    body: {
      orgId: jwtOrgId,
      branchId,
      queueId: classicQueueId,
      serviceId,
      customerName: 'Classic Walk-in',
      source: 'smoke',
    },
  });
  if (![200, 201].includes(classicIssue.status)) {
    throw new Error(`classic issue: ${classicIssue.status} ${JSON.stringify(classicIssue.json)}`);
  }

  const journeyIssue = await fetchJson('POST', '/tickets/staff/issue', {
    token: ownerToken,
    body: { branchId, queueId: journeyServiceQueueId, serviceId, customerName: 'Journey Walk-in' },
  });
  if (![200, 201].includes(journeyIssue.status)) {
    throw new Error(`journey issue: ${journeyIssue.status} ${JSON.stringify(journeyIssue.json)}`);
  }
  const journeyTicketId = unwrap(journeyIssue.json).id;

  const rolesRes = await fetchJson('GET', '/roles', { token: ownerToken });
  const roleIds = Object.fromEntries((unwrap(rolesRes.json) || []).map((r) => [r.name, r.id]));

  const inv = await fetchJson('POST', '/users/invite', {
    token: ownerToken,
    body: {
      email: memberEmail,
      firstName: 'Serve',
      lastName: 'Member',
      roleId: roleIds.admin,
      password,
    },
  });
  const memberUserId = unwrap(inv.json)?.id;
  const inviteToken = unwrap(inv.json)?.inviteToken;
  if (inviteToken) {
    await fetchJson('POST', '/auth/reset-password', { body: { token: inviteToken, password } });
  }

  async function assignRole(roleName) {
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
        ...(['manager', 'staff', 'viewer'].includes(roleName) ? { branchId } : {}),
      },
    });
    return login(memberEmail);
  }

  function laneTicketIds(workbench) {
    const ids = new Set();
    for (const lane of workbench?.lanes ?? []) {
      for (const item of lane.items ?? []) {
        if (item.id) ids.add(item.id);
      }
    }
    return ids;
  }

  async function testRole(roleName, token) {
    console.log(`\n● ${roleName}`);

    const canMutate = ['owner', 'admin', 'manager', 'staff'].includes(roleName);
    const canIssue = canMutate;

    // ── Single-step (classic queue ticket list) ──
    const classicList = await fetchJson(
      'GET',
      `/tickets?period=today&queueId=${encodeURIComponent(classicQueueId)}&limit=50`,
      { token },
    );
    const classicMeta = responseMeta(classicList.json);
    const classicRows = unwrap(classicList.json);
    const classicHasTicket = Array.isArray(classicRows) && classicRows.some((t) => t.queueId === classicQueueId);
    record(
      roleName,
      'single-step',
      'GET /tickets?period=today (classic queue) timezone',
      classicList.status === 200 && classicMeta?.timezone === BRANCH_TZ,
      classicMeta?.timezone ?? `HTTP ${classicList.status}`,
    );
    record(
      roleName,
      'single-step',
      'Classic waiting list includes today ticket',
      classicList.status === 200 && classicHasTicket,
      classicHasTicket ? 'found' : `HTTP ${classicList.status}`,
    );

    const classicStats = await fetchJson(
      'GET',
      `/tickets/queue/${encodeURIComponent(classicQueueId)}/stats?period=today`,
      { token },
    );
    record(
      roleName,
      'single-step',
      'GET /tickets/queue/:id/stats',
      classicStats.status === 200,
      `HTTP ${classicStats.status}`,
    );

    const classicPerf = await fetchJson(
      'GET',
      `/tickets/queue/${encodeURIComponent(classicQueueId)}/agent-performance?period=today`,
      { token },
    );
    record(
      roleName,
      'single-step',
      'GET /tickets/queue/:id/agent-performance',
      classicPerf.status === 200,
      `HTTP ${classicPerf.status}`,
    );

    // ── Multi-step (journey workbench + branch performance) ──
    const workbench = await fetchJson(
      'GET',
      `/workbench?branchId=${encodeURIComponent(branchId)}&deskNumber=${encodeURIComponent(deskNumber)}&forJourney=true&period=today`,
      { token },
    );
    const wb = unwrap(workbench.json);
    const wbIds = laneTicketIds(wb);
    record(
      roleName,
      'multi-step',
      'GET /workbench?forJourney=true',
      workbench.status === 200,
      `HTTP ${workbench.status}`,
    );
    record(
      roleName,
      'multi-step',
      'Workbench includes journey ticket (branch-local today)',
      workbench.status === 200 && wbIds.has(journeyTicketId),
      wbIds.has(journeyTicketId) ? 'journey ticket in lanes' : `lanes=${wbIds.size}`,
    );

    const journeyList = await fetchJson(
      'GET',
      `/tickets?period=today&queueId=${encodeURIComponent(journeyServiceQueueId)}&limit=50`,
      { token },
    );
    const journeyMeta = responseMeta(journeyList.json);
    record(
      roleName,
      'multi-step',
      'GET /tickets?period=today (journey queue) timezone',
      journeyList.status === 200 && journeyMeta?.timezone === BRANCH_TZ,
      journeyMeta?.timezone ?? `HTTP ${journeyList.status}`,
    );

    const journeyPerf = await fetchJson(
      'GET',
      `/tickets/branch/${encodeURIComponent(branchId)}/agent-performance?period=today&forJourney=true`,
      { token },
    );
    record(
      roleName,
      'multi-step',
      'GET branch agent-performance?forJourney=true',
      journeyPerf.status === 200,
      `HTTP ${journeyPerf.status}`,
    );

    const classicBranchPerf = await fetchJson(
      'GET',
      `/tickets/branch/${encodeURIComponent(branchId)}/agent-performance?period=today&forJourney=false`,
      { token },
    );
    record(
      roleName,
      'single-step',
      'GET branch agent-performance?forJourney=false',
      classicBranchPerf.status === 200,
      `HTTP ${classicBranchPerf.status}`,
    );

    const serveCtx = await fetchJson(
      'GET',
      `/workbench/branch-serve-context?branchId=${encodeURIComponent(branchId)}`,
      { token },
    );
    const mode = unwrap(serveCtx.json)?.mode;
    record(
      roleName,
      'multi-step',
      'Serve context mode is multi_step',
      serveCtx.status === 200 && mode === 'multi_step',
      mode ?? `HTTP ${serveCtx.status}`,
    );

    if (canIssue && roleName === 'staff') {
      const staffIssue = await fetchJson('POST', '/tickets/staff/issue', {
        token,
        body: {
          branchId,
          queueId: journeyServiceQueueId,
          serviceId,
          customerName: `Staff issue ${stamp}`,
        },
      });
      record(
        roleName,
        'multi-step',
        'POST /tickets/staff/issue (journey queue)',
        [200, 201].includes(staffIssue.status),
        `HTTP ${staffIssue.status}`,
      );
    }

    if (roleName === 'viewer') {
      const viewerIssue = await fetchJson('POST', '/tickets/staff/issue', {
        token,
        body: { branchId, queueId: classicQueueId, serviceId, customerName: 'Denied' },
      });
      record(
        roleName,
        'single-step',
        'Viewer cannot issue tickets',
        viewerIssue.status === 403,
        `HTTP ${viewerIssue.status}`,
      );
    }
  }

  await testRole('owner', ownerToken);

  for (const role of ['admin', 'manager', 'staff', 'viewer']) {
    const tok = await assignRole(role);
    await testRole(role, tok);
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n── Summary: ${results.length - failed.length}/${results.length} passed ──`);
  if (failed.length) {
    console.log('\nFailed:');
    for (const f of failed) {
      console.log(`  [${f.role}] [${f.surface}] ${f.check}${f.detail ? ` (${f.detail})` : ''}`);
    }
    process.exit(1);
  }
  console.log('\nAll single-step and multi-step role timezone checks passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
