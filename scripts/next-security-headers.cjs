/**
 * Shared security headers for Next.js apps (web + admin).
 * Set CSP_STRICT_MODE=1 to drop script-src 'unsafe-inline' (staging/production hardening).
 * Development adds 'unsafe-eval' so Next.js HMR / react-refresh can run (otherwise login and
 * other client components never hydrate).
 */
/**
 * Explicit origins the app is configured to talk to. `https:`/`wss:` already allow every
 * secure origin (so production, which uses an https API, needs nothing extra), but a plain
 * `http://` API/WS origin (local dev + CI smoke tests against localhost) is otherwise blocked
 * by connect-src. We add only the exact configured origin rather than blanket `http:`.
 */
function configuredConnectOrigins() {
  const origins = new Set();
  const candidates = [
    process.env.NEXT_PUBLIC_API_URL,
    process.env.NEXT_PUBLIC_CENTRIFUGO_WS_URL,
    process.env.API_BASE,
    process.env.API_URL,
  ];
  for (const value of candidates) {
    if (!value) continue;
    try {
      const url = new URL(value);
      origins.add(`${url.protocol}//${url.host}`);
    } catch {
      // ignore malformed env values
    }
  }
  return [...origins];
}

function buildContentSecurityPolicy() {
  const isDev = process.env.NODE_ENV !== 'production';
  const strict = process.env.CSP_STRICT_MODE === '1' || process.env.CSP_STRICT_MODE === 'true';
  const scriptParts = ["'self'"];
  if (!strict) scriptParts.push("'unsafe-inline'");
  if (isDev) scriptParts.push("'unsafe-eval'");
  const scriptSrc = `script-src ${scriptParts.join(' ')}`;
  const connectParts = ["'self'", 'https:', 'wss:', 'ws:', ...configuredConnectOrigins()];
  if (isDev) connectParts.push('http://localhost:*', 'ws://localhost:*');
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    scriptSrc,
    `connect-src ${connectParts.join(' ')}`,
  ].join('; ');
}

function securityHeaders() {
  const csp = buildContentSecurityPolicy();
  const reportOnly = process.env.CSP_REPORT_ONLY === '1' || process.env.CSP_REPORT_ONLY === 'true';
  const cspKey = reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';
  return [
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: cspKey, value: csp },
  ];
}

module.exports = { buildContentSecurityPolicy, securityHeaders };
