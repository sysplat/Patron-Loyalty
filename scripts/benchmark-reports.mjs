#!/usr/bin/env node

/**
 * Lightweight reports benchmark for release checks.
 * Creates an isolated org fixture, seeds queue traffic, then measures
 * report endpoint latencies over repeated requests.
 */

const API_BASE = (process.env.API_BASE || 'http://localhost:4000/api/v1').replace(/\/$/, '');
const PASSWORD = process.env.SMOKE_PASSWORD || 'RptBench!234';
const ITERATIONS = Number.parseInt(process.env.REPORT_BENCH_ITERATIONS || '12', 10);

const nowIsoDate = () => new Date().toISOString().slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(method, path, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { _raw: text }; }
  return { status: res.status, ok: res.ok, json };
}

async function requestWithRetry(method, path, options = {}, { attempts = 3, waitMs = 1200 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const res = await fetchJson(method, path, options);
    if (res.status !== 429) return res;
    if (attempt < attempts) {
      await sleep(waitMs * attempt);
    }
  }
  return fetchJson(method, path, options);
}

function assertStatus(label, status, accepted) {
  if (!accepted.includes(status)) {
    throw new Error(`${label}: expected ${accepted.join('|')}, got ${status}`);
  }
}

async function login(email, password) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await fetchJson('POST', '/auth/login', { body: { email: email.toLowerCase(), password } });
    if (r.status === 429) {
      await sleep(attempt === 1 ? 65_000 : 15_000);
      continue;
    }
    assertStatus('login', r.status, [200]);
    return r.json?.data?.tokens?.accessToken;
  }
  throw new Error(`login throttled for ${email}`);
}

function pct(values, percentile) {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((percentile / 100) * sorted.length));
  return sorted[idx];
}

async function timedGet(path, token) {
  const started = performance.now();
  const res = await fetchJson('GET', path, { token });
  const elapsed = Math.round(performance.now() - started);
  return { status: res.status, elapsed };
}

async function main() {
  const stamp = Date.now();
  const ownerEmail = `reports.bench+${stamp}@example.com`;

  const health = await fetchJson('GET', '/health');
  assertStatus('/health', health.status, [200]);

  const reg = await fetchJson('POST', '/auth/register', {
    body: {
      businessName: `Reports Bench ${stamp}`,
      firstName: 'Reports',
      lastName: 'Bench',
      email: ownerEmail,
      password: PASSWORD,
      acceptLegal: true,
    },
  });
  assertStatus('register', reg.status, [200, 201]);

  const token = await login(ownerEmail, PASSWORD);

  const branch = await fetchJson('POST', '/branches', { token, body: { name: `Bench Branch ${stamp}`, timezone: 'UTC' } });
  assertStatus('branch create', branch.status, [200, 201]);
  const branchId = branch.json?.data?.id;

  const service = await fetchJson('POST', '/services', {
    token,
    body: { name: `Bench Service ${stamp}`, queueEnabled: true, appointmentEnabled: false, durationMinutes: 15, branchIds: [branchId] },
  });
  assertStatus('service create', service.status, [200, 201]);
  const serviceId = service.json?.data?.id;

  const queue = await fetchJson('POST', '/queues', {
    token,
    body: { branchId, serviceId, name: `Bench Queue ${stamp}`, prefix: `B${(stamp % 900) + 100}` },
  });
  assertStatus('queue create', queue.status, [200, 201]);
  const queueId = queue.json?.data?.id;
  assertStatus('queue open', (await fetchJson('POST', `/queues/${queueId}/open`, { token })).status, [200]);

  const desk = await fetchJson('POST', '/desks', {
    token,
    body: { branchId, name: `Bench Desk ${stamp}`, number: `9-${String(stamp).slice(-6)}` },
  });
  assertStatus('desk create', desk.status, [200, 201]);
  const deskNumber = desk.json?.data?.number;

  // Seed minimal traffic.
  for (let i = 0; i < 24; i++) {
    const issue = await requestWithRetry('POST', '/tickets/issue', {
      body: {
        branchId,
        queueId,
        serviceId,
        customerName: `Bench ${i + 1}`,
        customerPhone: `+1555123${String(i).padStart(4, '0')}`,
        source: 'bench',
      },
    });
    assertStatus('ticket issue', issue.status, [200, 201]);
    if (i % 3 === 0) {
      const call = await requestWithRetry('POST', '/tickets/call-next', {
        token,
        body: { queueId, deskNumber, deskFilterActive: false },
      }, { attempts: 4, waitMs: 1500 });
      assertStatus('call-next', call.status, [200]);
    }
  }

  const date = nowIsoDate();
  const paths = [
    `/reports/overview?branchId=${encodeURIComponent(branchId)}`,
    `/reports/tickets-by-hour?date=${encodeURIComponent(date)}&branchId=${encodeURIComponent(branchId)}`,
    `/reports/service-performance?from=${encodeURIComponent(date)}&to=${encodeURIComponent(date)}&branchId=${encodeURIComponent(branchId)}`,
    `/reports/staff-performance?from=${encodeURIComponent(date)}&to=${encodeURIComponent(date)}&branchId=${encodeURIComponent(branchId)}`,
    `/reports/daily-summary?from=${encodeURIComponent(date)}&to=${encodeURIComponent(date)}&branchId=${encodeURIComponent(branchId)}`,
  ];

  console.log(`\nReports benchmark (${ITERATIONS} iterations each):`);
  for (const path of paths) {
    const samples = [];
    for (let i = 0; i < ITERATIONS; i++) {
      const { status, elapsed } = await timedGet(path, token);
      if (path.includes('service-performance') || path.includes('staff-performance') || path.includes('daily-summary')) {
        // advanced reports are enterprise-only; this run starts in free, so allow 403.
        assertStatus(path, status, [200, 403]);
      } else {
        assertStatus(path, status, [200]);
      }
      samples.push(elapsed);
    }
    const avg = Math.round(samples.reduce((sum, v) => sum + v, 0) / samples.length);
    const p95 = pct(samples, 95);
    const max = Math.max(...samples);
    console.log(`- ${path}: avg=${avg}ms p95=${p95}ms max=${max}ms`);
  }
}

main().catch((err) => {
  console.error(`\n[benchmark failed] ${err.message}`);
  process.exit(1);
});

