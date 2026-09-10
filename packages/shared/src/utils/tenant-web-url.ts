const DEFAULT_TENANT_WEB_URL = 'http://localhost:3003';

/**
 * Admin host → tenant loyalty app when NEXT_PUBLIC_LOYALTY_URL / WEB_URL unset at build time.
 * LMS admin impersonates into apps/loyalty (not QMS web).
 */
const ADMIN_HOST_TENANT_APP: Record<string, string> = {
  'loyalty-admin.sysplat.com': 'https://loyalty.sysplat.com',
  localhost: 'http://localhost:3003',
  '127.0.0.1': 'http://localhost:3003',
};

/**
 * Public tenant-facing app base URL for this product (Patron Loyalty).
 * Prefer NEXT_PUBLIC_LOYALTY_URL; WEB_URL kept as alias for shared admin codepaths.
 */
export function resolveTenantWebUrl(
  webUrl?: string | null,
  windowHostname?: string | null,
): string {
  const fromEnv =
    webUrl ??
    (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_LOYALTY_URL : undefined) ??
    (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_WEB_URL : undefined) ??
    (typeof process !== 'undefined' ? process.env.LOYALTY_URL : undefined) ??
    (typeof process !== 'undefined' ? process.env.APP_URL : undefined);

  if (fromEnv?.trim()) {
    return fromEnv.trim().replace(/\/$/, '');
  }

  if (windowHostname && ADMIN_HOST_TENANT_APP[windowHostname]) {
    return ADMIN_HOST_TENANT_APP[windowHostname];
  }

  return DEFAULT_TENANT_WEB_URL;
}
