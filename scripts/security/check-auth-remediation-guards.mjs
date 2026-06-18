import { readFileSync, existsSync } from 'node:fs';

function read(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

function assertContains(content, needle, message) {
  if (!content.includes(needle)) throw new Error(message);
}

function assertNotContains(content, needle, message) {
  if (content.includes(needle)) throw new Error(message);
}

const webMiddleware = read('../../apps/web/src/middleware.ts');
const adminMiddlewarePath = new URL('../../apps/admin/src/middleware.ts', import.meta.url);
if (!existsSync(adminMiddlewarePath)) {
  throw new Error('Admin middleware is missing. Expected apps/admin/src/middleware.ts');
}
const adminMiddleware = read('../../apps/admin/src/middleware.ts');
const webAuthStore = read('../../apps/web/src/lib/auth-store.ts');
const adminAuthStore = read('../../apps/admin/src/lib/auth-store.ts');

assertContains(webMiddleware, 'WEB_SESSION_COOKIE', 'Web middleware must gate on WEB_SESSION_COOKIE.');
assertContains(adminMiddleware, 'ADMIN_SESSION_COOKIE', 'Admin middleware must gate on ADMIN_SESSION_COOKIE.');

assertNotContains(
  webAuthStore,
  "name: 'qp-auth'",
  'Web auth store must not persist token-bearing qp-auth payloads.',
);
assertNotContains(
  adminAuthStore,
  "name: 'qp-admin-auth'",
  'Admin auth store must not persist token-bearing qp-admin-auth payloads.',
);
assertNotContains(
  webAuthStore,
  'sessionStorage.setItem(',
  'Web auth store should not back up impersonation tokens in sessionStorage.',
);
assertNotContains(
  adminAuthStore,
  'sessionStorage.setItem(',
  'Admin auth store should not back up impersonation tokens in sessionStorage.',
);

console.log('Auth remediation guard checks passed.');
