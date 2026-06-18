import { readFileSync } from 'node:fs';

function read(path) {
    return readFileSync(new URL(path, import.meta.url), 'utf8');
}

function assertContains(content, needle, message) {
    if (!content.includes(needle)) throw new Error(message);
}

function assertNotContains(content, needle, message) {
    if (content.includes(needle)) throw new Error(message);
}

function decodeJwtPayload(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const segment = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = segment + '='.repeat((4 - (segment.length % 4)) % 4);
        return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
    } catch {
        return null;
    }
}

function isDisplaySessionStaleOrNearExpiry(sessionToken, skewSeconds = 300) {
    const payload = decodeJwtPayload(sessionToken);
    if (!payload?.exp) return true;
    return payload.exp * 1000 <= Date.now() + skewSeconds * 1000;
}

const displayPage = read('../../apps/web/src/app/(display)/display/page.tsx');
const serverDisplayBff = read('../../apps/web/src/lib/server-display-bff.ts');
const realtimeRoute = read('../../apps/web/src/app/api/centrifugo-token/route.ts');
const sharedFrontend = read('../../packages/shared/src/utils/frontend.ts');

assertNotContains(displayPage, 'qp_display_session_token', 'Display page must not persist session token in storage.');
assertNotContains(displayPage, 'qp_display_device_id', 'Display page must not persist device id in storage.');
assertContains(displayPage, '/api/display/session', 'Display page must use display session BFF route.');
assertContains(displayPage, '/api/display/heartbeat', 'Display board must send heartbeat via BFF.');
assertContains(serverDisplayBff, 'DISPLAY_SESSION_COOKIE', 'Display BFF must set HttpOnly display session cookie.');
assertContains(serverDisplayBff, 'DISPLAY_API_KEY_COOKIE', 'Display BFF must store apiKey in HttpOnly cookie.');
assertContains(serverDisplayBff, 'refreshDisplaySessionFromApi', 'Display BFF must refresh session via apiKey.');
assertContains(serverDisplayBff, 'ensureDisplayCredentials', 'Display BFF must ensure credentials before proxying.');
assertContains(realtimeRoute, 'DISPLAY_API_KEY_COOKIE', 'Centrifugo route must prefer display apiKey credentials.');
assertContains(realtimeRoute, 'resolveDisplaySessionTokenForRealtime', 'Centrifugo route must resolve display session via BFF.');
assertContains(sharedFrontend, 'DISPLAY_CREDENTIAL_TTL_SECONDS', 'Shared frontend utils must define long-lived display credential TTL.');

const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
const farFuture = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
const nearFuture = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 60 })).toString('base64url');
const validToken = `${header}.${farFuture}.sig`;
const staleToken = `${header}.${nearFuture}.sig`;

if (decodeJwtPayload(validToken)?.exp == null) throw new Error('JWT decode helper failed on valid token');
if (isDisplaySessionStaleOrNearExpiry(validToken)) throw new Error('Valid token should not be stale');
if (!isDisplaySessionStaleOrNearExpiry(staleToken)) throw new Error('Near-expiry token should be stale');

console.log('Display session guard checks passed.');
