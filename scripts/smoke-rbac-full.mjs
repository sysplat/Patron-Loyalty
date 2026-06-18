#!/usr/bin/env node
/**
 * E2E smoke: RBAC per system role + optional email/SMS notification paths.
 *
 * Production RBAC invites need (temporary on API):
 *   EXPOSE_INVITE_TOKENS=true
 *
 * Environment:
 *   API_BASE            default http://localhost:4000/api/v1
 *   SMOKE_OWNER_EMAIL   optional
 *   SMOKE_MEMBER_EMAIL  optional
 *   SMOKE_PASSWORD      default SmokeRb@c3q1!
 *   SMS_TEST_NUMBER     optional E.164 for POST /notifications/test-sms (owner) + ticket customerPhone
 *   SMOKE_EMAIL_TO      optional for POST /notifications/send (owner)
 */

const API_BASE = (process.env.API_BASE || 'http://localhost:4000/api/v1').replace(
  /\/$/,
  '',
);

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

function okHttp(label, acceptable, actual) {
  if (!acceptable.includes(actual)) {
    throw new Error(
      `${label}: expected HTTP [${acceptable.join('|')}], got ${actual}`,
    );
  }
}

async function login(email, password) {
  // Retry when auth throttle returns 429.
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await fetchJson('POST', `/auth/login`, {
      body: { email: email.toLowerCase(), password },
    });
    if (r.status === 429) {
      const waitSec = attempt === 1 ? 65 : 15;
      console.log(`⚠ login rate-limited (attempt ${attempt}/3) — waiting ${waitSec}s…`);
      await sleep(waitSec * 1000);
      continue;
    }
    okHttp('login', [200], r.status);
    const access = r.json?.data?.tokens?.accessToken;
    if (!access) throw new Error('login: missing tokens in ' + JSON.stringify(r.json));
    return access;
  }
  throw new Error(`login: still rate-limited after retries for ${email}`);
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

/** DB column `tickets.source` is VARCHAR(10); keep values ≤ 10 chars. */
async function seedTwoTickets({ orgId, branchId, queueId, serviceId, sms }) {
  const p1 = sms && sms.trim() ? sms.trim() : '+15551230101';
  const p2 = '+15551230102';

  const bodyBase = {
    ...(orgId ? { orgId } : {}),
    branchId,
    queueId,
    serviceId,
    source: 'smoke',
  };

  const t1 = await fetchJson('POST', `/tickets/issue`, {
    body: {
      ...bodyBase,
      customerName: 'Smoke Ticket A',
      customerPhone: p1,
    },
  });
  okHttp('seed ticket A (public issue)', [200, 201], t1.status);

  const t2 = await fetchJson('POST', `/tickets/issue`, {
    body: {
      ...bodyBase,
      customerName: 'Smoke Ticket B',
      customerPhone: p2,
    },
  });
  okHttp('seed ticket B (public issue)', [200, 201], t2.status);
}

function jwtPayload(accessToken) {
  const [, payload] = String(accessToken).split('.');
  if (!payload) return null;
  const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  try {
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

async function main() {
  const stamp = Date.now();
  const password = process.env.SMOKE_PASSWORD || 'SmokeRb@c3q1!';
  const ownerEmail = (
    process.env.SMOKE_OWNER_EMAIL || `smoke.owner+${stamp}@example.com`
  ).toLowerCase();
  const memberEmail = (
    process.env.SMOKE_MEMBER_EMAIL || `smoke.member+${stamp}@example.com`
  ).toLowerCase();
  const smsTarget = (process.env.SMS_TEST_NUMBER || '').trim();
  const emailQueueTarget = (process.env.SMOKE_EMAIL_TO || '').trim();

  console.log(`API_BASE=${API_BASE}`);

  {
    /** Railway / cold tiers may return transient 503 while the service wakes. */
    let h;
    let lastStatus = 0;
    for (let attempt = 0; attempt < 15; attempt++) {
      h = await fetchJson('GET', `/health`);
      lastStatus = h.status;
      if (h.status === 200 && h.json?.status === 'ok') break;
      if (attempt < 14) {
        console.log(
          `/health → ${lastStatus} (waiting for API, attempt ${attempt + 1}/15)`,
        );
        await sleep(15_000);
      }
    }
    okHttp('/health', [200], lastStatus);
    if (h.json?.status !== 'ok')
      throw new Error('Unexpected /health payload');
  }

  await sleep(400);

  {
    const reg = await fetchJson('POST', `/auth/register`, {
      body: {
        businessName: `Smoke RBAC ${stamp}`,
        firstName: 'Smoke',
        lastName: 'Owner',
        email: ownerEmail,
        password,
        acceptLegal: true,
      },
    });
    okHttp('/auth/register owner', [200, 201], reg.status);
  }

  await sleep(500);

  const ownerToken = await login(ownerEmail, password);
  const jwtOrgId = jwtPayload(ownerToken)?.orgId;
  if (!jwtOrgId || typeof jwtOrgId !== 'string') {
    throw new Error(
      'Cannot read orgId from owner access token JWT (needed for public ticket seed).',
    );
  }

  const branchName = `Br ${stamp}`;
  let branchId = '';
  let serviceId = '';
  let queueId = '';
  let memberUserId = '';
  let deskNumber = '1';

  {
    const b = await fetchJson('POST', `/branches`, {
      token: ownerToken,
      body: {
        name: branchName,
        timezone: 'UTC',
      },
    });
    okHttp('POST branches', [200, 201], b.status);
    branchId = b.json?.data?.id || b.json?.id;
    if (!branchId) throw new Error('branch id missing: ' + JSON.stringify(b.json));
  }

  {
    const svc = await fetchJson('POST', `/services`, {
      token: ownerToken,
      body: {
        name: `Srv ${stamp}`,
        queueEnabled: true,
        appointmentEnabled: false,
        durationMinutes: 15,
        serviceEstimateLowMinutes: 10,
        serviceEstimateHighMinutes: 20,
        branchIds: [branchId],
      },
    });
    okHttp('POST services', [200, 201], svc.status);
    serviceId = svc.json?.data?.id;
    if (!serviceId) throw new Error('service id missing: ' + JSON.stringify(svc.json));
  }

  {
    const q = await fetchJson('POST', `/queues`, {
      token: ownerToken,
      body: {
        branchId,
        serviceId,
        name: `Q ${stamp}`,
        prefix: `K${((stamp % 899) | 0) + 100}`,
      },
    });
    okHttp('POST queues', [200, 201], q.status);
    queueId = q.json?.data?.id;
    if (!queueId) throw new Error('queue id missing: ' + JSON.stringify(q.json));

    const op = await fetchJson(`POST`, `/queues/${queueId}/open`, {
      token: ownerToken,
    });
    okHttp('OPEN queue', [200], op.status);
  }

  {
    const d = await fetchJson('POST', `/desks`, {
      token: ownerToken,
      body: {
        branchId,
        name: `Main ${stamp}`,
        number: `1-${String(stamp).slice(-6)}`,
      },
    });
    okHttp('POST desks', [200, 201], d.status);
    const deskRow = d.json?.data ?? d.json;
    const deskId = deskRow?.id;
    if (deskRow?.number) deskNumber = String(deskRow.number);

    if (deskId) {
      const openDesk = await fetchJson('PATCH', `/desks/${deskId}`, {
        token: ownerToken,
        body: { status: 'open' },
      });
      okHttp('OPEN desk', [200], openDesk.status);
    }
  }

  await sleep(200);

  const rolesRes = await fetchJson(`GET`, `/roles`, {
    token: ownerToken,
  });
  okHttp('GET roles', [200], rolesRes.status);
  const roleRows = rolesRes.json?.data;
  const roleIds = {};
  for (const row of roleRows || []) roleIds[row.name] = row.id;
  for (const n of ['admin', 'manager', 'staff', 'viewer']) {
    if (!roleIds[n]) throw new Error(`Missing seeded role '${n}'`);
  }

  if (smsTarget) {
    const r = await fetchJson('POST', `/notifications/test-sms`, {
      token: ownerToken,
      body: { to: smsTarget },
    });
    const msg =
      typeof r.json?.message === 'string'
        ? r.json.message
        : JSON.stringify(r.json?.message ?? r.json ?? '');
    if ((r.status === 200 || r.status === 201) && r.ok) {
      console.log(`✓ test-sms queued for ${smsTarget}`);
    } else if (
      r.status === 403 &&
      /sms|upgrade|professional|plan/i.test(String(msg))
    ) {
      console.log(
        `⚠ test-sms blocked by plan (${r.status}) — SMS needs Professional/Enterprise on this tenant. Skipping. Message: ${msg}`,
      );
    } else {
      okHttp('owner POST /notifications/test-sms', [200, 201], r.status);
    }
  } else {
    console.log('⚠ set SMS_TEST_NUMBER to exercise outbound SMS via Twilio worker');
  }

  if (emailQueueTarget) {
    const r = await fetchJson('POST', `/notifications/send`, {
      token: ownerToken,
      body: {
        channel: 'email',
        to: emailQueueTarget,
        subject: `[smoke rbac] ${stamp}`,
        body: `Stamp ${stamp}; API=${API_BASE}`,
      },
    });
    okHttp('owner POST /notifications/send email', [200, 201], r.status);
    console.log(`✓ transactional email queued to ${emailQueueTarget}`);
  } else {
    console.log('⚠ set SMOKE_EMAIL_TO to queue SMTP/SendGrid path');
  }

  {
    const fp = await fetchJson('POST', `/auth/forgot-password`, {
      body: { email: ownerEmail },
    });
    okHttp('/auth/forgot-password', [200], fp.status);
  }

  await sleep(500);

  {
    const inv = await fetchJson('POST', `/users/invite`, {
      token: ownerToken,
      body: {
        email: memberEmail,
        firstName: 'Member',
        lastName: 'Smoke',
        roleId: roleIds.admin,
        password,
      },
    });
    okHttp(`POST invite admin`, [200, 201], inv.status);

    const payload = inv.json?.data ?? inv.json;
    const inviteToken = payload?.inviteToken;
    memberUserId = payload?.id;
    if (!memberUserId) {
      throw new Error(`invite response missing user id\n${JSON.stringify(inv.json)}`);
    }

    if (inviteToken) {
      await sleep(300);
      const reset = await fetchJson(`POST`, `/auth/reset-password`, {
        body: { token: inviteToken, password },
      });
      okHttp('/auth/reset-password', [200], reset.status);
    }
  }

  const qb = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
  const date = todayUtc();

  async function rotate(roleName) {
    const ud = await fetchJson(`GET`, `/users/${memberUserId}`, {
      token: ownerToken,
    });
    okHttp(`GET member ${memberUserId}`, [200], ud.status);
    const userPayload = ud.json?.data ?? ud.json;
    const assignmentId = userPayload?.roleAssignments?.[0]?.id;
    if (!assignmentId) throw new Error('roleAssignments missing on member');

    const del = await fetchJson(`DELETE`, `/roles/assignments/${assignmentId}`, {
      token: ownerToken,
    });
    okHttp('DELETE assignments', [204, 200], del.status);

    const asg = await fetchJson(`POST`, `/roles/assign`, {
      token: ownerToken,
      body: {
        userId: memberUserId,
        roleId: roleIds[roleName],
        ...(['manager', 'staff', 'viewer'].includes(roleName) ? { branchId } : {}),
      },
    });
    okHttp(`POST roles/assign -> ${roleName}`, [200, 201], asg.status);
    return login(memberEmail, password);
  }

  async function assertMatrix(name, persona, tok) {
    console.log(`\n● ${name}`);

    const assertCode = async (label, acceptable, fn) => {
      const actual = await fn();
      okHttp(`${name} · ${label}`, acceptable, actual);
    };

    await assertCode(`${persona} billing`, persona === 'owner' ? [200] : [403], async () => {
      const r = await fetchJson(`GET`, `/billing/subscription`, { token: tok });
      return r.status;
    });

    await assertCode(
      `${persona} settings GET`,
      persona === 'owner' ? [200] : [403],
      async () => {
        const r = await fetchJson(`GET`, `/settings`, { token: tok });
        return r.status;
      },
    );

    await assertCode(
      `${persona} notif templates`,
      persona === 'owner' || persona === 'admin' ? [200] : [403],
      async () => {
        const r = await fetchJson(`GET`, `/notifications/templates`, {
          token: tok,
        });
        return r.status;
      },
    );

    await assertCode(`${persona} org PATCH`, persona === 'owner' ? [200] : [403], async () => {
      const r = await fetchJson(`PATCH`, `/organization`, {
        token: tok,
        body: { timezone: 'UTC' },
      });
      return r.status;
    });

    await assertCode(
      `${persona} report overview`,
      ['owner', 'admin', 'manager', 'viewer'].includes(persona) ? [200] : [403],
      async () => {
        const r = await fetchJson(`GET`, `/reports/overview${qb}`, {
          token: tok,
        });
        return r.status;
      },
    );

    await assertCode(`${persona} ticket list`, [200], async () => {
      const r = await fetchJson(
        `GET`,
        `/tickets${qb}&date=${encodeURIComponent(date)}`,
        { token: tok },
      );
      return r.status;
    });

    await assertCode(
      `${persona} queue PATCH`,
      ['owner', 'admin', 'manager', 'staff'].includes(persona) ? [200] : [403],
      async () => {
        const r = await fetchJson(`PATCH`, `/queues/${queueId}`, {
          token: tok,
          body: { name: `${String(name)} r` },
        });
        return r.status;
      },
    );

    if (persona === 'manager') {
      await assertCode('manager desks POST', [201, 200], async () => {
        const r = await fetchJson(`POST`, `/desks`, {
          token: tok,
          body: {
            branchId,
            name: `M desk ${stamp}`,
            number: `M${String(stamp).slice(-8)}`,
          },
        });
        return r.status;
      });
    }

    if (persona === 'viewer') {
      await assertCode('viewer test-sms denied', [403], async () => {
        const r = await fetchJson(`POST`, `/notifications/test-sms`, {
          token: tok,
          body: { to: '+15551237777' },
        });
        return r.status;
      });
    }

    if (persona === 'staff') {
      console.log(`${name}: seed tickets + call-next`);
      await seedTwoTickets({
        orgId: jwtOrgId,
        branchId,
        queueId,
        serviceId,
        sms: smsTarget,
      });
      await sleep(500);
      const cn = await fetchJson(`POST`, `/tickets/call-next`, {
        token: tok,
        body: { queueId, deskNumber, deskFilterActive: false },
      });
      okHttp(`${name}: call-next`, [200], cn.status);
    }
  }

  await assertMatrix('OWNER bearer', 'owner', ownerToken);

  let memberTok = await login(memberEmail, password);
  await assertMatrix('MEMBER(admin)', 'admin', memberTok);

  memberTok = await rotate('manager');
  await assertMatrix('MEMBER(manager)', 'manager', memberTok);

  memberTok = await rotate('staff');
  await assertMatrix('MEMBER(staff)', 'staff', memberTok);

  memberTok = await rotate('viewer');
  await assertMatrix('MEMBER(viewer)', 'viewer', memberTok);

  console.log('\n✅ RBAC + notification probes completed successfully.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
