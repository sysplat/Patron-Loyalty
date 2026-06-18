/**
 * Load monorepo root .env (and optional .env.local) into process.env for Next.js apps.
 * Does not override variables already set in the shell.
 */
const fs = require('fs');
const path = require('path');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key || process.env[key] !== undefined) continue;
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

function loadMonorepoEnv(appDir) {
  const root = path.join(appDir, '../..');
  loadEnvFile(path.join(root, '.env'));
  loadEnvFile(path.join(root, '.env.local'));
  loadEnvFile(path.join(appDir, '.env'));
  loadEnvFile(path.join(appDir, '.env.local'));
}

function resolveApiUpstreamUrl() {
  const apiUrl = process.env.API_URL?.replace(/\/$/, '');
  if (!apiUrl) return 'http://localhost:4000';
  return apiUrl.replace(/\/api\/v1$/, '');
}

function normalizeApiV1Base(url) {
  const base = url.replace(/\/$/, '');
  if (base.startsWith('/')) {
    return base.endsWith('/api/v1') ? base : `${base}/api/v1`.replace(/\/+/g, '/');
  }
  return base.endsWith('/api/v1') ? base : `${base}/api/v1`;
}

function resolvePublicApiUrl() {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return normalizeApiV1Base(process.env.NEXT_PUBLIC_API_URL);
  }
  const apiUrl = process.env.API_URL?.replace(/\/$/, '');
  if (!apiUrl) return 'http://localhost:4000/api/v1';
  return normalizeApiV1Base(apiUrl);
}

/** Browser-facing API base. Dev uses same-origin `/api/v1` proxy to avoid production CORS. */
function resolveBrowserApiUrl(isDev) {
  const explicit = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  if (explicit?.startsWith('/')) {
    return normalizeApiV1Base(explicit);
  }
  if (isDev) return '/api/v1';
  return explicit ? normalizeApiV1Base(explicit) : resolvePublicApiUrl();
}

module.exports = { loadMonorepoEnv, resolveApiUpstreamUrl, resolvePublicApiUrl, resolveBrowserApiUrl };
