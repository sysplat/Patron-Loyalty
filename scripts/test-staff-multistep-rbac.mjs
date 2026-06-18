#!/usr/bin/env node
/**
 * Verifies staff multi-step RBAC against a running API:
 * - Staff may open queues and use journey workbench
 * - Staff is denied flow-templates (owner/admin only)
 */

const API_BASE = (process.env.API_BASE || 'http://localhost:4000/api/v1').replace(/\/$/, '');
const PASSWORD = process.env.SMOKE_PASSWORD || 'SmokeRb@c3q1!';
const stamp = Date.now();

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

function assertStatus(label, actual, acceptable, json) {
  if (!acceptable.includes(actual)) {
    const detail = json ? ` — ${JSON.stringify(json)}` : '';
    throw new Error(`${label}: expected [${acceptable.join('|')}], got ${actual}${detail}`);
  }
  console.log(`  ✓ ${label} → ${actual}`);
}

async function login(email, password) {
  const r = await fetchJson('POST', '/auth/login', {
    body: { email: email.toLowerCase(), password },
  });
  assertStatus('login', r.status, [200]);
  const access = r.json?.data?.tokens?.accessToken;
  if (!access) throw new Error('login: missing access token');
  return access;
}

async function main() {
  const ownerEmail = `smoke.ms.owner+${stamp}@example.com`;
  const staffEmail = `smoke.ms.staff+${stamp}@example.com`;

  console.log(`API: ${API_BASE}`);

  const health = await fetchJson('GET', '/health');
  assertStatus('health', health.status, [200]);

  const reg = await fetchJson('POST', '/auth/register', {
    body: {
      businessName: `MS RBAC ${stamp}`,
      email: ownerEmail,
      password: PASSWORD,
      firstName: 'Owner',
      lastName: 'Smoke',
      acceptLegal: true,
    },
  });
  assertStatus('register', reg.status, [200, 201]);

  const ownerToken = await login(ownerEmail, PASSWORD);

  await fetchJson('PATCH', '/organization', {
    token: ownerToken,
    body: { visitJourneysEnabled: true },
  });

  const roles = await fetchJson('GET', '/roles', { token: ownerToken });
  assertStatus('roles', roles.status, [200]);
  const roleList = roles.json?.data ?? roles.json ?? [];
  const staffRole = roleList.find((r) => r.name === 'staff');
  if (!staffRole?.id) throw new Error('staff role not found');

  const branchRes = await fetchJson('POST', '/branches', {
    token: ownerToken,
    body: { name: 'Main', timezone: 'UTC' },
  });
  assertStatus('create branch', branchRes.status, [200, 201]);
  const branchId = branchRes.json?.data?.id ?? branchRes.json?.id;
  if (!branchId) throw new Error('branch id missing');

  const deskRes = await fetchJson('POST', '/desks', {
    token: ownerToken,
    body: { branchId, name: 'Counter 1', number: '1' },
  });
  assertStatus('create desk', deskRes.status, [200, 201]);
  const deskId = deskRes.json?.data?.id ?? deskRes.json?.id;
  await fetchJson('PATCH', `/desks/${deskId}`, {
    token: ownerToken,
    body: { status: 'open' },
  });

  const svcRes = await fetchJson('POST', '/services', {
    token: ownerToken,
    body: {
      name: 'Service A',
      queueEnabled: true,
      appointmentEnabled: false,
      durationMinutes: 15,
      serviceEstimateLowMinutes: 5,
      serviceEstimateHighMinutes: 15,
      branchIds: [branchId],
    },
  });
  assertStatus('create service', svcRes.status, [200, 201]);
  const serviceId = svcRes.json?.data?.id ?? svcRes.json?.id;

  const q1Res = await fetchJson('POST', '/queues', {
    token: ownerToken,
    body: {
      branchId,
      serviceId,
      name: `Service step ${stamp}`,
      prefix: `S${String(stamp).slice(-3)}`,
      journeyModeOverride: 'visit_multi_step',
      stepRole: 'service',
      callingPolicy: 'manual_only',
    },
  });
  assertStatus('create service-step queue', q1Res.status, [200, 201]);
  const queueId = q1Res.json?.data?.id ?? q1Res.json?.id;

  const q2Res = await fetchJson('POST', '/queues', {
    token: ownerToken,
    body: {
      branchId,
      serviceId,
      name: `Pickup step ${stamp}`,
      prefix: `P${String(stamp).slice(-3)}`,
      journeyModeOverride: 'visit_multi_step',
      stepRole: 'pickup',
      callingPolicy: 'ready_then_manual',
    },
  });
  assertStatus('create pickup-step queue', q2Res.status, [200, 201]);
  const pickupQueueId = q2Res.json?.data?.id ?? q2Res.json?.id;

  const flowRes = await fetchJson('POST', '/flow-templates', {
    token: ownerToken,
    body: {
      branchId,
      name: `Flow ${stamp}`,
      steps: [
        {
          stepIndex: 1,
          serviceId,
          queueId,
          stepRole: 'service',
          callingPolicy: 'manual_only',
        },
        {
          stepIndex: 2,
          serviceId,
          queueId: pickupQueueId,
          stepRole: 'pickup',
          callingPolicy: 'ready_then_manual',
        },
      ],
    },
  });
  assertStatus('create flow template', flowRes.status, [200, 201]);
  const flowId = flowRes.json?.data?.id ?? flowRes.json?.id;

  const activateRes = await fetchJson('POST', `/flow-templates/${flowId}/activate`, {
    token: ownerToken,
  });
  assertStatus('activate flow', activateRes.status, [200, 201]);

  const openOwner = await fetchJson('POST', `/queues/${queueId}/open`, { token: ownerToken });
  assertStatus('owner open queue', openOwner.status, [200]);

  const invite = await fetchJson('POST', '/users/invite', {
    token: ownerToken,
    body: {
      email: staffEmail,
      firstName: 'Staff',
      lastName: 'Smoke',
      roleId: staffRole.id,
      password: PASSWORD,
      branchIds: [branchId],
    },
  });
  assertStatus('invite staff', invite.status, [200, 201]);

  const staffToken = await login(staffEmail, PASSWORD);

  const flowsDenied = await fetchJson('GET', `/flow-templates?branchId=${branchId}`, {
    token: staffToken,
  });
  assertStatus('staff flow-templates denied', flowsDenied.status, [403]);

  const flowsOwner = await fetchJson('GET', `/flow-templates?branchId=${branchId}`, {
    token: ownerToken,
  });
  assertStatus('owner flow-templates allowed', flowsOwner.status, [200]);

  const pauseOwner = await fetchJson('POST', `/queues/${queueId}/pause`, { token: ownerToken });
  assertStatus('owner pause queue', pauseOwner.status, [200]);

  const staffOpen = await fetchJson('POST', `/queues/${queueId}/open`, { token: staffToken });
  if (staffOpen.status === 403) {
    throw new Error(
      `staff queue open forbidden — restart API so role permissions sync: ${JSON.stringify(staffOpen.json)}`,
    );
  }
  assertStatus('staff queue open (resume)', staffOpen.status, [200]);

  const issue = await fetchJson('POST', '/tickets/staff/issue', {
    token: staffToken,
    body: { branchId, queueId, serviceId, customerName: 'Walk-in Test' },
  });
  assertStatus('staff issue ticket', issue.status, [200, 201]);

  const wb = await fetchJson(
    'GET',
    `/workbench?branchId=${branchId}&deskNumber=1&forJourney=true`,
    { token: staffToken },
  );
  assertStatus('staff journey workbench', wb.status, [200], wb.json);

  const stationProfileId = wb.json?.data?.session?.stationProfileId;
  if (!stationProfileId) throw new Error('journey workbench missing stationProfileId');

  const ticketId = issue.json?.data?.id ?? issue.json?.id;
  const callSpecific = await fetchJson('POST', '/workbench/actions/call-specific', {
    token: staffToken,
    body: { stationProfileId, ticketId, deskNumber: '1' },
  });
  assertStatus('staff manual call (call-specific)', callSpecific.status, [200], callSpecific.json);

  console.log('\n✅ Staff multi-step RBAC checks passed.');
}

main().catch((e) => {
  console.error('\n❌', e.message || e);
  process.exit(1);
});
