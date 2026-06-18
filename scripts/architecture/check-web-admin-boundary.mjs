import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const webSrcRoot = path.join(repoRoot, 'apps/web/src');

const forbiddenPaths = [
  'apps/web/src/app/(dashboard)/superadmin/page.tsx',
  'apps/web/src/app/(dashboard)/dashboard/operations/support/page.tsx',
  'apps/web/src/app/(dashboard)/dashboard/operations/tenants/page.tsx',
];

/** Tenant web may call only these platform-admin API paths (impersonation exit from banner). */
const allowedPlatformAdminApiPaths = new Set(['/platform-admin/impersonation/end']);

const forbiddenRouteSegments = [
  { pattern: /\/superadmin(\/|$)/, label: 'superadmin route segment' },
  {
    pattern: /\/dashboard\/operations\/support(\/|$)/,
    label: 'platform support under tenant operations',
  },
  {
    pattern: /\/dashboard\/operations\/tenants(\/|$)/,
    label: 'platform tenants under tenant operations',
  },
];

function pathExists(relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function collectSourceFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      collectSourceFiles(fullPath, files);
      continue;
    }
    if (/\.(tsx?|jsx?|mdx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function extractPlatformAdminPaths(source) {
  const matches = [];
  const re = /['"`]\/platform-admin\/[^'"`]+['"`]/g;
  for (const match of source.matchAll(re)) {
    const raw = match[0].slice(1, -1);
    matches.push(raw.split('?')[0]);
  }
  return matches;
}

let hasErrors = false;

for (const forbiddenPath of forbiddenPaths) {
  if (pathExists(forbiddenPath)) {
    hasErrors = true;
    console.error(
      `[WEB ADMIN BOUNDARY ERROR] Forbidden tenant-web platform route path exists: ${forbiddenPath}`,
    );
  }
}

for (const filePath of collectSourceFiles(path.join(webSrcRoot, 'app'))) {
  const relative = path.relative(repoRoot, filePath).replaceAll('\\', '/');
  for (const { pattern, label } of forbiddenRouteSegments) {
    if (pattern.test(relative)) {
      hasErrors = true;
      console.error(
        `[WEB ADMIN BOUNDARY ERROR] Forbidden ${label} in tenant web app route: ${relative}`,
      );
    }
  }
}

for (const filePath of collectSourceFiles(webSrcRoot)) {
  const relative = path.relative(repoRoot, filePath).replaceAll('\\', '/');
  const source = fs.readFileSync(filePath, 'utf8');
  for (const apiPath of extractPlatformAdminPaths(source)) {
    if (!allowedPlatformAdminApiPaths.has(apiPath)) {
      hasErrors = true;
      console.error(
        `[WEB ADMIN BOUNDARY ERROR] Forbidden platform-admin API reference in tenant web: ${apiPath} (${relative})`,
      );
    }
  }
}

if (hasErrors) {
  console.error(
    '\nTenant web/admin boundary check failed. Platform-operator routes must live in apps/admin only.',
  );
  process.exit(1);
}

console.log('✅ Web/admin boundary check passed.');
