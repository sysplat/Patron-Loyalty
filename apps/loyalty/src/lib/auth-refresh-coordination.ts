import { useAuthStore } from '@/lib/auth-store';
import { syncAccessTokenFromBff } from '@/lib/sync-access-token-from-bff';

export type RefreshSessionResult = 'success' | 'invalid' | 'unavailable';

const REFRESH_LOCK_KEY = 'qp-auth-refresh-lock';
const LOCK_TTL_MS = 20_000;

function readLockUntil(): number | null {
  try {
    const raw = localStorage.getItem(REFRESH_LOCK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { until?: number };
    return typeof parsed.until === 'number' ? parsed.until : null;
  } catch {
    return null;
  }
}

function tryAcquireRefreshLock(): boolean {
  try {
    const now = Date.now();
    const until = readLockUntil();
    if (until != null && until > now) return false;
    localStorage.setItem(REFRESH_LOCK_KEY, JSON.stringify({ until: now + LOCK_TTL_MS }));
    return true;
  } catch {
    return true;
  }
}

function releaseRefreshLock(): void {
  try {
    localStorage.removeItem(REFRESH_LOCK_KEY);
  } catch {
    /* ignore */
  }
}

async function waitForPeerRefresh(maxMs = 15_000): Promise<void> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const until = readLockUntil();
    if (until == null || until <= Date.now()) return;
    await new Promise((r) => setTimeout(r, 150));
  }
}

/** After another tab refreshed HttpOnly cookies, pull a fresh access JWT via BFF token sync. */
export async function syncAccessTokenAfterPeerRefresh(): Promise<RefreshSessionResult> {
  try {
    const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
    if (res.status === 401 || res.status === 403) return 'invalid';
    if (!res.ok) return 'unavailable';
    const payload = (await res.json().catch(() => null)) as {
      success?: boolean;
      data?: { platformOperator?: boolean };
    } | null;
    if (!payload?.success) return 'unavailable';
    const synced = await syncAccessTokenFromBff();
    if (!synced) return 'unavailable';
    if (typeof payload.data?.platformOperator === 'boolean') {
      useAuthStore.getState().updateUser({ platformOperator: payload.data.platformOperator });
    }
    return 'success';
  } catch {
    return 'unavailable';
  }
}

/**
 * Serialize refresh across browser tabs. Refresh rotation revokes the prior
 * refresh token, so concurrent refreshes from two tabs can log the user out.
 */
export async function coordinateRefresh(
  performRefresh: () => Promise<RefreshSessionResult>,
): Promise<RefreshSessionResult> {
  if (!tryAcquireRefreshLock()) {
    await waitForPeerRefresh();
    return syncAccessTokenAfterPeerRefresh();
  }

  try {
    return await performRefresh();
  } finally {
    releaseRefreshLock();
  }
}
