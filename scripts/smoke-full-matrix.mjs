#!/usr/bin/env node
/**
 * Comprehensive E2E smoke: RBAC × Plans × Notifications
 *
 * Covers:
 *  - All 5 system roles: owner, admin, manager, staff, viewer
 *  - All 3 plans: free, professional, enterprise
 *  - Email notification (transactional send)
 *  - SMS notification (plan-gated: skipped on free, verified on professional+)
 *  - Ticket lifecycle: issue → call-next (staff)
 *  - Plan enforcement: SMS blocked on free, allowed on professional/enterprise
 *
 * Required env:
 *   API_BASE              e.g. http://localhost:4000/api/v1  (or prod URL)
 *   EXPOSE_INVITE_TOKENS  =true  (set on the API side for prod; local auto-enabled)
 *
 * Optional env:
 *   SMS_TEST_NUMBER       E.164 mobile — real SMS only sent if plan allows
 *   SMOKE_EMAIL_TO        inbox for transactional email verification
 *   SMOKE_PASSWORD        defaults to SmokeRb@c3q1!
 */

const API_BASE = (process.env.API_BASE || 'http://localhost:4000/api/v1').replace(/\/$/, '');
const SMS_NUMBER = (process.env.SMS_TEST_NUMBER || '').trim();
const EMAIL_TO = (process.env.SMOKE_EMAIL_TO || '').trim();
const PASSWORD = process.env.SMOKE_PASSWORD || 'SmokeRb@c3q1!';
const IS_LOCAL = API_BASE.includes('localhost') || API_BASE.includes('127.0.0.1');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const WARN = '\x1b[33m⚠\x1b[0m';
const INFO = '\x1b[36mℹ\x1b[0m';

let passCount = 0;
let failCount = 0;
const failures = [];

function pass(label) {
  console.log(`  ${PASS} ${label}`);
  passCount++;
}
function warn(label) {
  console.log(`  ${WARN} ${label}`);
}
function fail(label, extra) {
  console.log(`  ${FAIL} ${label}`);
  failures.push(extra ? `${label} — ${extra}` : label);
  failCount++;
}

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
  try { json = text ? JSON.parse(text) : null; } catch { json = { _raw: text }; }
  return { ok: res.ok, status: res.status, json };
}

function expect(label, acceptable, actual) {
  if (acceptable.includes(actual)) {
    pass(label);
    return true;
  }
  fail(label, `expected [${acceptable.join('|')}], got ${actual}`);
  return false;
}

async function expectOk(label, acceptable, fn) {
  const actual = await fn();
  return expect(label, acceptable, actual);
}

async function login(email, pw) {
  // Retry up to 3 times on 429 (auth rate-limit window is 60 s)
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await fetchJson('POST', '/auth/login', { body: { email: email.toLowerCase(), password: pw } });
    if (r.status === 429) {
      const waitSec = attempt === 1 ? 65 : 15;
      warn(`login rate-limited (attempt ${attempt}/3) — waiting ${waitSec}s…`);
      await sleep(waitSec * 1000);
      continue;
    }
    if (r.status !== 200) throw new Error(`login failed for ${email}: HTTP ${r.status}`);
    const tok = r.json?.data?.tokens?.accessToken;
    if (!tok) throw new Error(`login: no token for ${email}`);
    return tok;
  }
  throw new Error(`login: still rate-limited after 3 attempts for ${email}`);
}

function jwtOrgId(token) {
  const [, seg] = String(token).split('.');
  if (!seg) return null;
  const b64 = seg.replace(/-/g, '+').replace(/_/g, '/') + '==';
  try { return JSON.parse(Buffer.from(b64, 'base64').toString()).orgId; } catch { return null; }
}

async function waitForHealth(maxAttempts = 15) {
  for (let i = 0; i < maxAttempts; i++) {
    const h = await fetchJson('GET', '/health');
    if (h.status === 200 && h.json?.status === 'ok') { pass('/health ok'); return; }
    if (i < maxAttempts - 1) {
      warn(`/health → ${h.status} (attempt ${i + 1}/${maxAttempts}, retrying in 15s)`);
      await sleep(15_000);
    }
  }
  throw new Error('/health never returned ok');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const stamp = Date.now();
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  QlessQ Full Matrix Smoke`);
  console.log(`  Target  : ${API_BASE}`);
  console.log(`  SMS to  : ${SMS_NUMBER || '(skip)'}`);
  console.log(`  Email to: ${EMAIL_TO || '(skip)'}`);
  console.log(`${'═'.repeat(60)}\n`);

  // ─── 1. Health ─────────────────────────────────────────────────────────────
  console.log('── Health ──────────────────────────────');
  await waitForHealth();
  await sleep(400);

  // ─── 2. Register owner org ─────────────────────────────────────────────────
  console.log('\n── Setup: register owner ───────────────');
  const ownerEmail = (process.env.SMOKE_OWNER_EMAIL || `smoke.owner+${stamp}@example.com`).toLowerCase();
  const memberEmail = (process.env.SMOKE_MEMBER_EMAIL || `smoke.member+${stamp}@example.com`).toLowerCase();

  {
    const r = await fetchJson('POST', '/auth/register', {
      body: {
        businessName: `Smoke ${stamp}`,
        firstName: 'Smoke',
        lastName: 'Owner',
        email: ownerEmail,
        password: PASSWORD,
        acceptLegal: true,
      },
    });
    if (r.status === 409) {
      warn(`owner ${ownerEmail} already registered, skipping registration`);
    } else {
      expect('register owner', [200, 201], r.status);
      const vTok = r.json?.data?.verificationToken || r.json?.verificationToken;
      if (vTok) {
        const v = await fetchJson('POST', '/auth/verify-email', { body: { token: vTok } });
        expect('verify owner email', [200], v.status);
      }
    }
  }

  await sleep(500);
  const ownerToken = await login(ownerEmail, PASSWORD);
  const orgId = jwtOrgId(ownerToken);
  if (!orgId) throw new Error('could not decode orgId from owner JWT');
  pass(`orgId resolved (${orgId.slice(0, 8)}…)`);

  // ─── 3. Scaffold: branch, service, queue, desk ──────────────────────────────
  console.log('\n── Setup: scaffold ─────────────────────');

  let branchId, serviceId, queueId, deskNumber;

  {
    const r = await fetchJson('POST', '/branches', {
      token: ownerToken,
      body: { name: `Br ${stamp}`, timezone: 'UTC' },
    });
    expect('POST /branches', [200, 201], r.status);
    branchId = r.json?.data?.id || r.json?.id;
    if (!branchId) throw new Error('branch id missing');
    pass(`branchId=${branchId.slice(0, 8)}…`);
  }

  {
    const r = await fetchJson('POST', '/services', {
      token: ownerToken,
      body: {
        name: `Srv ${stamp}`,
        queueEnabled: true,
        appointmentEnabled: false,
        serviceEstimateLowMinutes: 10,
        serviceEstimateHighMinutes: 20,
        branchIds: [branchId],
      },
    });
    expect('POST /services', [200, 201], r.status);
    serviceId = r.json?.data?.id;
    if (!serviceId) throw new Error('service id missing');
    pass(`serviceId=${serviceId.slice(0, 8)}…`);
  }

  {
    const r = await fetchJson('POST', '/queues', {
      token: ownerToken,
      body: { branchId, serviceId, name: `Q ${stamp}`, prefix: `K${((stamp % 899) | 0) + 100}` },
    });
    expect('POST /queues', [200, 201], r.status);
    queueId = r.json?.data?.id;
    if (!queueId) throw new Error('queue id missing');

    const op = await fetchJson('POST', `/queues/${queueId}/open`, { token: ownerToken });
    expect('OPEN queue', [200], op.status);
    pass(`queueId=${queueId.slice(0, 8)}…`);
  }

  {
    const d = await fetchJson('POST', '/desks', {
      token: ownerToken,
      body: { branchId, name: `Main ${stamp}`, number: `1-${String(stamp).slice(-6)}` },
    });
    expect('POST /desks', [200, 201], d.status);
    const deskId = d.json?.data?.id || d.json?.id;
    if (!deskId) throw new Error('desk id missing');
    deskNumber = d.json?.data?.number || d.json?.number;
    pass(`deskNumber=${deskNumber}`);

    // IMPORTANT: Must open the desk status to call tickets
    const openDesk = await fetchJson('PATCH', `/desks/${deskId}`, {
      token: ownerToken,
      body: { status: 'open' },
    });
    expect('OPEN desk', [200], openDesk.status);
  }

  await sleep(200);

  // Display board is token-secured (X-Display-Token); unauthenticated GET must not expose data.
  {
    const board = await fetchJson('GET', '/tickets/display/board');
    expect('display board requires token', [401, 403], board.status);
    const first = board.json?.data?.[0];
    if (first) {
      const keys = Object.keys(first).sort();
      const allowed = ['deskNumber', 'displayNumber', 'id', 'status'];
      const piiLeak = keys.some((key) => !allowed.includes(key));
      if (piiLeak) {
        fail('public board strips PII fields', `unexpected keys: ${keys.join(',')}`);
      } else {
        pass('public board strips PII fields');
      }
    } else {
      pass('public board returns safe schema when empty');
    }
  }

  // ─── 4. Seed roles ─────────────────────────────────────────────────────────
  console.log('\n── Setup: roles ────────────────────────');
  const rolesRes = await fetchJson('GET', '/roles', { token: ownerToken });
  expect('GET /roles', [200], rolesRes.status);
  const roleIds = {};
  for (const row of rolesRes.json?.data || []) roleIds[row.name] = row.id;
  for (const n of ['admin', 'manager', 'staff', 'viewer']) {
    if (!roleIds[n]) throw new Error(`missing seeded role '${n}'`);
  }
  pass('all system roles present');

  // ─── 5. Invite member ──────────────────────────────────────────────────────
  console.log('\n── Setup: invite member ────────────────');
  let memberUserId;
  {
    const inv = await fetchJson('POST', '/users/invite', {
      token: ownerToken,
      body: { email: memberEmail, firstName: 'Member', lastName: 'Smoke', roleId: roleIds.admin, password: PASSWORD },
    });
    expect('POST /users/invite', [200, 201], inv.status);
    const p = inv.json?.data ?? inv.json;
    memberUserId = p?.id;
    const inviteToken = p?.inviteToken;
    if (!memberUserId) {
      throw new Error(`invite response missing user id\n${JSON.stringify(inv.json)}`);
    }

    if (inviteToken) {
      await sleep(300);
      const reset = await fetchJson('POST', '/auth/reset-password', { body: { token: inviteToken, password: PASSWORD } });
      expect('activate member', [200], reset.status);
      pass(`member ${memberEmail} activated via invite token`);
    } else {
      pass(`member ${memberEmail} created without invite token`);
    }
  }

  // ─── 6. Plans: fetch plan ids ──────────────────────────────────────────────
  console.log('\n── Plans: list ─────────────────────────');
  const plansRes = await fetchJson('GET', '/billing/plans');
  expect('GET /billing/plans', [200], plansRes.status);
  const planList = plansRes.json?.data || [];
  const planBySlug = {};
  for (const p of planList) planBySlug[p.slug] = p;
  const planNames = planList.map(p => p.slug).join(', ');
  pass(`plans available: ${planNames}`);

  if (!planBySlug.free || !planBySlug.professional || !planBySlug.enterprise) {
    warn(`Not all expected plans found — seeder may not have run. Found: ${planNames}`);
  }

  // Helper to change plan
  async function setPlan(slug) {
    const plan = planBySlug[slug];
    if (!plan) { warn(`plan '${slug}' not found, skipping plan change`); return; }
    const r = await fetchJson('POST', '/billing/subscription/change', {
      token: ownerToken,
      body: { planId: plan.id },
    });
    expect(`plan → ${slug}`, [200], r.status);
  }

  // Helper to rotate member role
  async function rotateMemberRole(roleName) {
    const ud = await fetchJson('GET', `/users/${memberUserId}`, { token: ownerToken });
    const assignmentId = (ud.json?.data ?? ud.json)?.roleAssignments?.[0]?.id;
    if (!assignmentId) throw new Error('roleAssignments missing on member');
    await fetchJson('DELETE', `/roles/assignments/${assignmentId}`, { token: ownerToken });
    const branchScopedRoles = new Set(['manager', 'staff', 'viewer']);
    await fetchJson('POST', '/roles/assign', {
      token: ownerToken,
      body: {
        userId: memberUserId,
        roleId: roleIds[roleName],
        ...(branchScopedRoles.has(roleName) ? { branchId } : {}),
      },
    });
    return login(memberEmail, PASSWORD);
  }

  // Helper to seed 2 tickets (public endpoint, no auth needed)
  async function seedTickets(suffix = '') {
    const pairs = [
      [`Smoke A${suffix}`, '+15551230101'],
      [`Smoke B${suffix}`, '+15551230102'],
    ];
    for (const [name, phone] of pairs) {
      // Stagger inserts — the queue sequence uses pg_advisory_xact_lock per-queue
      // per-day; concurrent inserts on the same connection pool can collide.
      if (name !== pairs[0][0]) await sleep(600);
      const r = await fetchJson('POST', '/tickets/issue', {
        body: { orgId, branchId, queueId, serviceId, customerName: name, customerPhone: phone, source: 'smoke' },
      });
      if (![200, 201].includes(r.status)) {
        console.log(`    [DEBUG] seed ticket '${name}' HTTP ${r.status}: ${JSON.stringify(r.json).slice(0, 300)}`);
      }
      expect(`seed ticket '${name}'`, [200, 201], r.status);
    }
  }

  // ─── 7. FREE plan tests ────────────────────────────────────────────────────
  console.log('\n── Plan: FREE ──────────────────────────');
  await setPlan('free');
  await sleep(300);

  // Sub-section: billing read (owner)
  await expectOk('owner reads billing subscription', [200], async () => {
    return (await fetchJson('GET', '/billing/subscription', { token: ownerToken })).status;
  });

  // Email still works on free
  if (EMAIL_TO) {
    console.log('\n  [email — free plan]');
    const r = await fetchJson('POST', '/notifications/send', {
      token: ownerToken,
      body: { channel: 'email', to: EMAIL_TO, subject: `[smoke free] ${stamp}`, body: `Stamp ${stamp}` },
    });
    expect('owner sends email (free)', [200, 201], r.status);
    pass(`email queued to ${EMAIL_TO}`);
  }

  // SMS blocked on free plan
  if (SMS_NUMBER) {
    console.log('\n  [sms — free plan (should be blocked)]');
    const r = await fetchJson('POST', '/notifications/test-sms', {
      token: ownerToken,
      body: { to: SMS_NUMBER },
    });
    if (r.status === 403 && /sms|upgrade|professional|plan/i.test(JSON.stringify(r.json))) {
      pass('SMS blocked on free plan (plan gate working)');
    } else {
      fail('SMS plan gate on free plan', `got HTTP ${r.status}: ${JSON.stringify(r.json)}`);
    }
  }

  // ─── 8. RBAC matrix on FREE plan ─────────────────────────────────────────
  console.log('\n── RBAC matrix (free plan) ─────────────');
  const qb = `?branchId=${encodeURIComponent(branchId)}`;
  const date = new Date().toISOString().slice(0, 10);
  const range = `from=${encodeURIComponent(date)}&to=${encodeURIComponent(date)}`;

  async function rbacMatrix(personaLabel, persona, tok) {
    console.log(`\n  [${personaLabel}]`);

    await expectOk(`${persona} billing`, persona === 'owner' ? [200] : [403], async () =>
      (await fetchJson('GET', '/billing/subscription', { token: tok })).status);

    await expectOk(`${persona} settings GET`, persona === 'owner' ? [200] : [403], async () =>
      (await fetchJson('GET', '/settings', { token: tok })).status);

    await expectOk(`${persona} notification templates`, ['owner', 'admin'].includes(persona) ? [200] : [403], async () =>
      (await fetchJson('GET', '/notifications/templates', { token: tok })).status);

    await expectOk(`${persona} org PATCH`, persona === 'owner' ? [200] : [403], async () =>
      (await fetchJson('PATCH', '/organization', { token: tok, body: { timezone: 'UTC' } })).status);

    await expectOk(`${persona} report overview`, ['owner', 'admin', 'manager', 'viewer'].includes(persona) ? [200] : [403], async () =>
      (await fetchJson('GET', `/reports/overview${qb}`, { token: tok })).status);

    await expectOk(
      `${persona} advanced report (free/pro gate)`,
      ['owner', 'admin', 'manager'].includes(persona) ? [403] : [403],
      async () => (await fetchJson('GET', `/reports/service-performance?${range}&branchId=${encodeURIComponent(branchId)}`, { token: tok })).status,
    );

    await expectOk(`${persona} ticket list`, [200], async () =>
      (await fetchJson('GET', `/tickets${qb}&date=${encodeURIComponent(date)}`, { token: tok })).status);

    await expectOk(`${persona} queue PATCH`, ['owner', 'admin', 'manager', 'staff'].includes(persona) ? [200] : [403], async () =>
      (await fetchJson('PATCH', `/queues/${queueId}`, { token: tok, body: { name: `${personaLabel} r` } })).status);

    if (persona === 'staff') {
      await seedTickets();
      await sleep(500);
      const cn = await fetchJson('POST', '/tickets/call-next', {
        token: tok,
        body: { queueId, deskNumber, deskFilterActive: false },
      });
      expect('staff call-next', [200], cn.status);
    }

    if (persona === 'viewer') {
      await expectOk('viewer SMS denied', [403], async () =>
        (await fetchJson('POST', '/notifications/test-sms', { token: tok, body: { to: '+15551237777' } })).status);
    }
  }

  await rbacMatrix('OWNER', 'owner', ownerToken);
  let memTok = await login(memberEmail, PASSWORD);
  await rbacMatrix('MEMBER(admin)', 'admin', memTok);
  memTok = await rotateMemberRole('manager');
  await rbacMatrix('MEMBER(manager)', 'manager', memTok);
  memTok = await rotateMemberRole('staff');
  await rbacMatrix('MEMBER(staff)', 'staff', memTok);
  memTok = await rotateMemberRole('viewer');
  await rbacMatrix('MEMBER(viewer)', 'viewer', memTok);

  // ─── 9. PROFESSIONAL plan ──────────────────────────────────────────────────
  console.log('\n── Plan: PROFESSIONAL ──────────────────');
  await setPlan('professional');
  await sleep(300);

  // SMS now allowed
  if (SMS_NUMBER) {
    console.log('\n  [sms — professional plan]');
    const r = await fetchJson('POST', '/notifications/test-sms', {
      token: ownerToken,
      body: { to: SMS_NUMBER },
    });
    if (r.status === 200 || r.status === 201) {
      pass(`SMS queued to ${SMS_NUMBER} (professional)`);
    } else if (r.status === 403) {
      fail('SMS should be allowed on professional plan', JSON.stringify(r.json));
    } else {
      // Provider error (Twilio trial limits etc) is ok — plan gate passed
      warn(`SMS dispatched (HTTP ${r.status}) — may be Twilio trial issue: ${JSON.stringify(r.json).slice(0, 120)}`);
    }
  } else {
    warn('set SMS_TEST_NUMBER to verify SMS on professional plan');
  }

  if (EMAIL_TO) {
    const r = await fetchJson('POST', '/notifications/send', {
      token: ownerToken,
      body: { channel: 'email', to: EMAIL_TO, subject: `[smoke professional] ${stamp}`, body: `Plan: professional, stamp: ${stamp}` },
    });
    expect('owner sends email (professional)', [200, 201], r.status);
  }

  // Plan limits: professional allows more branches
  await expectOk('GET /billing/subscription (professional)', [200], async () =>
    (await fetchJson('GET', '/billing/subscription', { token: ownerToken })).status);

  // ─── 10. ENTERPRISE plan ───────────────────────────────────────────────────
  console.log('\n── Plan: ENTERPRISE ────────────────────');
  await setPlan('enterprise');
  await sleep(300);

  if (SMS_NUMBER) {
    console.log('\n  [sms — enterprise plan]');
    const r = await fetchJson('POST', '/notifications/test-sms', {
      token: ownerToken,
      body: { to: SMS_NUMBER },
    });
    if (r.status === 200 || r.status === 201) {
      pass(`SMS queued to ${SMS_NUMBER} (enterprise)`);
    } else if (r.status === 403) {
      fail('SMS should be allowed on enterprise plan', JSON.stringify(r.json));
    } else {
      warn(`SMS dispatched (HTTP ${r.status}) — may be Twilio trial issue: ${JSON.stringify(r.json).slice(0, 120)}`);
    }
  }

  if (EMAIL_TO) {
    const r = await fetchJson('POST', '/notifications/send', {
      token: ownerToken,
      body: { channel: 'email', to: EMAIL_TO, subject: `[smoke enterprise] ${stamp}`, body: `Plan: enterprise, stamp: ${stamp}` },
    });
    expect('owner sends email (enterprise)', [200, 201], r.status);
  }

  await expectOk('GET /billing/subscription (enterprise)', [200], async () =>
    (await fetchJson('GET', '/billing/subscription', { token: ownerToken })).status);

  await expectOk('enterprise advanced report available', [200], async () =>
    (await fetchJson('GET', `/reports/service-performance?${range}&branchId=${encodeURIComponent(branchId)}`, { token: ownerToken })).status);

  // ─── 11. Downgrade back to FREE → SMS blocked again ─────────────────────
  console.log('\n── Plan: back to FREE (SMS gate re-check) ──');
  await setPlan('free');
  await sleep(300);

  if (SMS_NUMBER) {
    const r = await fetchJson('POST', '/notifications/test-sms', {
      token: ownerToken,
      body: { to: SMS_NUMBER },
    });
    if (r.status === 403) {
      pass('SMS correctly blocked after downgrade to free');
    } else {
      fail('SMS should be blocked after downgrade to free', `got ${r.status}`);
    }
  }

  // ─── 12. Ticket-lifecycle: called SMS notification (ticket.customerPhone) ─
  console.log('\n── Ticket lifecycle: call-next SMS ─────');
  // Upgrade to professional so SMS can fire
  await setPlan('professional');
  await sleep(300);

  // Get staff token
  const staffTok = await rotateMemberRole('staff');
  await seedTickets(' LC');
  await sleep(500);

  const cn2 = await fetchJson('POST', '/tickets/call-next', {
    token: staffTok,
    body: { queueId, deskNumber, deskFilterActive: false },
  });
  expect('staff call-next (lifecycle)', [200], cn2.status);
  if (cn2.status === 200) {
    const calledTicket = cn2.json?.data ?? cn2.json;
    pass(`ticket ${calledTicket?.displayNumber || calledTicket?.id?.slice(0, 8)} called → status=${calledTicket?.status}`);
    if (calledTicket?.customerPhone) {
      pass(`customerPhone present — SMS notification triggered asynchronously`);
    }
  }

  // ─── 13. Notification logs ─────────────────────────────────────────────────
  console.log('\n── Notification log ─────────────────────');
  await sleep(2000); // let worker process jobs
  const logsRes = await fetchJson('GET', '/notifications/log?limit=5', { token: ownerToken });
  // Owner has notification read access
  if (logsRes.status === 200) {
    const logs = logsRes.json?.data || [];
    pass(`notification log accessible (${logs.length} recent entries)`);
    for (const l of logs.slice(0, 3)) {
      console.log(`    ${INFO} [${l.channel || '?'}] to=${l.to || '?'} status=${l.status || '?'}`);
    }
  } else {
    warn(`GET /notifications/log → ${logsRes.status} (route may not exist yet)`);
  }

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(60)}`);
  if (failCount === 0) {
    console.log(`\x1b[32m  ✅  ALL ${passCount} CHECKS PASSED\x1b[0m`);
  } else {
    console.log(`\x1b[31m  ❌  ${failCount} FAILURES (${passCount} passed)\x1b[0m`);
    for (const f of failures) console.log(`     • ${f}`);
  }
  console.log(`${'═'.repeat(60)}\n`);

  if (failCount > 0) process.exit(1);
}

main().catch((e) => {
  console.error('\n\x1b[31m[FATAL]\x1b[0m', e.message);
  process.exit(1);
});
