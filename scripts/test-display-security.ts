/**
 * Display Security E2E Test Script
 *
 * Tests reverse pairing + API Key + Signed Token lifecycle:
 *
 * Checklist:
 * ✅ 1. Register org + create branch (setup)
 * ✅ 2. TV requests pairing code (public)
 * ✅ 3. Admin links code to branch → TV claims credentials
 * ✅ 4. Consumed pairing code rejected on re-link
 * ✅ 5. Use sessionToken to fetch display board (secure endpoint)
 * ✅ 6. Use sessionToken for heartbeat (display-authenticated)
 * ✅ 7. Missing token → rejected
 * ✅ 8. Invalid token → rejected
 * ✅ 9. Token refresh via API key → new sessionToken
 * ✅ 10. Refreshed token works
 * ✅ 11. Revoke device → token rejected
 * ✅ 12. Revoked API key → rejected
 * ✅ 13. Public lobby board endpoints disabled (404)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:4000/api/v1';

async function fetchJson(
  method: string,
  path: string,
  opts?: { token?: string; body?: any; headers?: Record<string, string> },
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts?.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts?.headers) Object.assign(headers, opts.headers);
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: (json as any).data, json };
}

let token = '';
let orgId = '';
let branchId = '';

async function setup() {
  console.log('\n🔧 SETUP: Creating org + branch + queue...');

  const stamp = Date.now().toString().slice(-6);
  const email = `display-sec-${stamp}@example.com`;
  const password = 'Password123!';

  // Register
  const reg = await fetchJson('POST', '/auth/register', {
    body: {
      businessName: `Display Security Test ${stamp}`,
      firstName: 'Display',
      lastName: 'Tester',
      email,
      password,
      acceptLegal: true,
    },
  });
  if (!reg.ok) throw new Error(`Registration failed: ${JSON.stringify(reg.json)}`);

  // Bypass email verification
  await prisma.account.update({ where: { email }, data: { emailVerified: true } });
  await prisma.user.updateMany({ where: { email }, data: { emailVerified: true } });

  // Login
  const login = await fetchJson('POST', '/auth/login', { body: { email, password } });
  if (!login.ok) throw new Error(`Login failed: ${JSON.stringify(login.json)}`);
  token = login.data.tokens.accessToken;
  orgId = login.data.user.orgId;

  // Create branch
  const branch = await fetchJson('POST', '/branches', {
    token,
    body: { name: 'Lobby Branch', timezone: 'UTC' },
  });
  if (!branch.ok) throw new Error(`Branch creation failed: ${JSON.stringify(branch.json)}`);
  branchId = branch.data.id;

  console.log(`  ✅ Org: ${orgId}`);
  console.log(`  ✅ Branch: ${branchId}`);
}

async function test1_requestTvPairingCode() {
  console.log('\n📺 TEST 1: TV requests pairing code (public)...');
  const res = await fetchJson('POST', '/display/pairing/request', {});
  if (!res.ok) throw new Error(`Pairing request failed: ${JSON.stringify(res.json)}`);
  const { code, sessionId } = res.data;
  console.log(`  ✅ Code: ${code} (session ${String(sessionId).slice(0, 8)}…)`);
  return { code: code as string, sessionId: sessionId as string };
}

async function test2_linkAndClaim(pairing: { code: string; sessionId: string }) {
  console.log('\n🔗 TEST 2: Admin links screen, TV claims credentials...');
  const fingerprint = 'tv-lobby-fingerprint-sha256-test';

  const linkRes = await fetchJson('POST', '/display/pairing/link', {
    token,
    body: { code: pairing.code, branchId, name: 'Lobby TV' },
  });
  if (!linkRes.ok) throw new Error(`Link failed: ${JSON.stringify(linkRes.json)}`);

  const claimRes = await fetchJson('POST', '/display/pairing/claim', {
    body: { sessionId: pairing.sessionId, deviceFingerprint: fingerprint },
  });
  if (!claimRes.ok) throw new Error(`Claim failed: ${JSON.stringify(claimRes.json)}`);
  const { apiKey, sessionToken, device } = claimRes.data;
  console.log(`  ✅ Device ID: ${device.id}`);
  console.log(`  ✅ API Key: ${apiKey.substring(0, 20)}...`);
  console.log(`  ✅ Session Token: ${sessionToken.substring(0, 30)}...`);
  console.log(`  ✅ Status: ${device.status}`);
  return { apiKey, sessionToken, deviceId: device.id, fingerprint, code: pairing.code };
}

async function test3_consumedCodeRejected(code: string) {
  console.log('\n🚫 TEST 3: Re-link with consumed pairing code...');
  const res = await fetchJson('POST', '/display/pairing/link', {
    token,
    body: { code, branchId },
  });
  if (res.status >= 400) {
    console.log(`  ✅ Correctly rejected (${res.status})`);
  } else {
    throw new Error(`Expected rejection, got ${res.status}: ${JSON.stringify(res.json)}`);
  }
}

async function test4_secureDisplayBoard(sessionToken: string) {
  console.log('\n📊 TEST 4: Fetch display board with valid session token...');
  const res = await fetchJson('GET', '/tickets/display/board', {
    headers: { 'X-Display-Token': sessionToken },
  });
  if (!res.ok)
    throw new Error(`Secure board fetch failed (${res.status}): ${JSON.stringify(res.json)}`);
  console.log(`  ✅ Board data received (${res.status})`);
}

async function test5_heartbeat(sessionToken: string) {
  console.log('\n💓 TEST 5: Send heartbeat with session token...');
  const res = await fetchJson('POST', '/display/devices/heartbeat', {
    headers: { 'X-Display-Token': sessionToken },
  });
  if (!res.ok) throw new Error(`Heartbeat failed (${res.status}): ${JSON.stringify(res.json)}`);
  console.log(`  ✅ Heartbeat accepted`);
}

async function test6_missingToken() {
  console.log('\n🚫 TEST 6: Fetch board WITHOUT token...');
  const res = await fetchJson('GET', '/tickets/display/board');
  if (res.status === 401) {
    console.log(`  ✅ Correctly rejected with 401`);
  } else {
    throw new Error(`Expected 401, got ${res.status}`);
  }
}

async function test7_invalidToken() {
  console.log('\n🚫 TEST 7: Fetch board with INVALID token...');
  const res = await fetchJson('GET', '/tickets/display/board', {
    headers: { 'X-Display-Token': 'totally.fake.token' },
  });
  if (res.status === 401) {
    console.log(`  ✅ Correctly rejected with 401`);
  } else {
    throw new Error(`Expected 401, got ${res.status}`);
  }
}

async function test8_refreshToken(apiKey: string, fingerprint: string) {
  console.log('\n🔄 TEST 8: Refresh session token via API key...');
  const res = await fetchJson('POST', '/display/devices/refresh-token', {
    body: { apiKey, deviceFingerprint: fingerprint },
  });
  if (!res.ok) throw new Error(`Token refresh failed (${res.status}): ${JSON.stringify(res.json)}`);
  const { sessionToken, deviceId } = res.data;
  console.log(`  ✅ New session token: ${sessionToken.substring(0, 30)}...`);
  console.log(`  ✅ Device ID confirmed: ${deviceId}`);
  return sessionToken as string;
}

async function test9_refreshedTokenWorks(newToken: string) {
  console.log('\n📊 TEST 9: Fetch board with REFRESHED token...');
  const res = await fetchJson('GET', '/tickets/display/board', {
    headers: { 'X-Display-Token': newToken },
  });
  if (!res.ok) throw new Error(`Board fetch with new token failed (${res.status})`);
  console.log(`  ✅ Board data received with refreshed token`);
}

async function test10_revokeDevice(deviceId: string) {
  console.log('\n🔒 TEST 10: Revoke device from admin dashboard...');
  const res = await fetchJson('POST', `/display/devices/${deviceId}/revoke`, { token });
  if (!res.ok) throw new Error(`Revocation failed (${res.status}): ${JSON.stringify(res.json)}`);
  console.log(`  ✅ Device revoked — status: ${res.data.status}`);
}

async function test11_revokedTokenRejected(sessionToken: string) {
  console.log('\n🚫 TEST 11: Fetch board with REVOKED device token...');
  // Wait for Redis cache invalidation
  await new Promise((r) => setTimeout(r, 1500));

  const res = await fetchJson('GET', '/tickets/display/board', {
    headers: { 'X-Display-Token': sessionToken },
  });
  if (res.status === 401) {
    console.log(`  ✅ Correctly rejected — device is revoked`);
  } else {
    throw new Error(`Expected 401 after revocation, got ${res.status}`);
  }
}

async function test12_revokedApiKeyRejected(apiKey: string) {
  console.log('\n🚫 TEST 12: Refresh token with REVOKED API key...');
  const res = await fetchJson('POST', '/display/devices/refresh-token', {
    body: { apiKey },
  });
  if (res.status === 401) {
    console.log(`  ✅ Correctly rejected — API key invalidated`);
  } else {
    throw new Error(`Expected 401, got ${res.status}`);
  }
}

async function test13_publicDisplayBoardDisabled() {
  console.log('\n🚫 TEST 13: Public display board routes must be disabled (enterprise)...');
  const res = await fetchJson('GET', `/tickets/public/display-board/branch/${branchId}`);
  if (res.status === 404) {
    console.log(`  ✅ Public board by branch id returns 404`);
  } else {
    throw new Error(`Expected 404 for removed public route, got ${res.status}`);
  }
  const slugRes = await fetchJson('GET', `/tickets/public/display-board/slug/test-org/test-branch`);
  if (slugRes.status === 404) {
    console.log(`  ✅ Public board by slug returns 404`);
  } else {
    throw new Error(`Expected 404 for removed public slug route, got ${slugRes.status}`);
  }
}

async function main() {
  console.log('🔐 DISPLAY SECURITY E2E TEST');
  console.log('═'.repeat(60));

  let passed = 0;
  let failed = 0;

  try {
    await setup();

    const pairing = await test1_requestTvPairingCode();
    passed++;
    const { apiKey, sessionToken, deviceId, fingerprint, code } = await test2_linkAndClaim(pairing);
    passed++;
    await test3_consumedCodeRejected(code);
    passed++;
    await test4_secureDisplayBoard(sessionToken);
    passed++;
    await test5_heartbeat(sessionToken);
    passed++;
    await test6_missingToken();
    passed++;
    await test7_invalidToken();
    passed++;
    const newToken = await test8_refreshToken(apiKey, fingerprint);
    passed++;
    await test9_refreshedTokenWorks(newToken);
    passed++;
    await test10_revokeDevice(deviceId);
    passed++;
    await test11_revokedTokenRejected(newToken);
    passed++;
    await test12_revokedApiKeyRejected(apiKey);
    passed++;
    await test13_publicDisplayBoardDisabled();
    passed++;
  } catch (err: any) {
    failed++;
    console.error(`\n❌ FAILED: ${err.message}`);
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`\n📊 RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);

  if (failed === 0) {
    console.log('\n✨ ALL DISPLAY SECURITY TESTS PASSED!');
  } else {
    console.log('\n🔴 SOME TESTS FAILED — see output above');
    process.exit(1);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
