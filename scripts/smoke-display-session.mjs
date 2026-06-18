#!/usr/bin/env node
/**
 * Display session smoke — static guards + API refresh lifecycle when API is reachable.
 *
 * Usage: node scripts/smoke-display-session.mjs
 * Requires: API on localhost:4000 for live steps (skipped if unreachable).
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_BASE = process.env.API_BASE || 'http://localhost:4000/api/v1';

function runGuardScript() {
    const res = spawnSync('node', [path.join(__dirname, 'security/check-display-session-guards.mjs')], {
        stdio: 'inherit',
    });
    if (res.status !== 0) {
        throw new Error('Display session guard checks failed');
    }
}

async function fetchJson(method, urlPath, { token, body, headers = {} } = {}) {
    const hdrs = { ...headers };
    if (body !== undefined) hdrs['Content-Type'] = 'application/json';
    if (token) hdrs.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${urlPath}`, {
        method,
        headers: hdrs,
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, json };
}

async function apiReachable() {
    try {
        const res = await fetch(`${API_BASE}/health/live`, { method: 'GET' });
        return res.ok;
    } catch {
        return false;
    }
}

async function liveRefreshSmoke() {
    console.log('\n[live] API reachable — running display refresh smoke...');

    const stamp = Date.now().toString().slice(-6);
    const email = `display-smoke-${stamp}@example.com`;
    const password = 'Password123!';

    const reg = await fetchJson('POST', '/auth/register', {
        body: {
            businessName: `Display Smoke ${stamp}`,
            firstName: 'Display',
            lastName: 'Smoke',
            email,
            password,
            acceptLegal: true,
        },
    });
    if (!reg.ok) throw new Error(`register failed: ${reg.status}`);

    const login = await fetchJson('POST', '/auth/login', { body: { email, password } });
    const token = login.json?.data?.tokens?.accessToken;
    if (!token) throw new Error('login failed');

    const branchRes = await fetchJson('POST', '/branches', {
        token,
        body: { name: 'Lobby', timezone: 'UTC' },
    });
    const branchId = branchRes.json?.data?.id;
    if (!branchId) throw new Error('branch create failed');

    const requestRes = await fetchJson('POST', '/display/pairing/request', {});
    const code = requestRes.json?.data?.code;
    const sessionId = requestRes.json?.data?.sessionId;
    if (!code || !sessionId) throw new Error('pairing request failed');

    const linkRes = await fetchJson('POST', '/display/pairing/link', {
        token,
        body: { code, branchId, name: 'Smoke TV' },
    });
    if (!linkRes.ok) throw new Error(`pairing link failed: ${linkRes.status}`);

    const claimRes = await fetchJson('POST', '/display/pairing/claim', {
        body: { sessionId, deviceFingerprint: 'smoke-display-fp' },
    });
    const apiKey = claimRes.json?.data?.apiKey;
    const sessionToken = claimRes.json?.data?.sessionToken;
    if (!apiKey || !sessionToken) throw new Error('pairing claim failed');

    const boardRes = await fetchJson('GET', '/tickets/display/board', {
        headers: { 'X-Display-Token': sessionToken },
    });
    if (!boardRes.ok) throw new Error(`board with session failed: ${boardRes.status}`);

    const refreshRes = await fetchJson('POST', '/display/devices/refresh-token', {
        body: { apiKey, deviceFingerprint: 'smoke-display-fp' },
    });
    const newToken = refreshRes.json?.data?.sessionToken;
    if (!newToken) throw new Error('refresh-token failed');

    const board2 = await fetchJson('GET', '/tickets/display/board', {
        headers: { 'X-Display-Token': newToken },
    });
    if (!board2.ok) throw new Error(`board with refreshed token failed: ${board2.status}`);

    console.log('[live] pairing → board → refresh → board OK');
}

async function main() {
    console.log('Display session smoke');
    runGuardScript();

    if (await apiReachable()) {
        await liveRefreshSmoke();
    } else {
        console.log('\n[skip] API not reachable — static guard checks only');
    }

    console.log('\nDisplay session smoke passed.');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
