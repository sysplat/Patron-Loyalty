import { refreshAccessToken } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

/** Decode JWT `exp` (seconds) without verifying signature — scheduling only. */
function getAccessTokenExpiryMs(accessToken: string): number | null {
  try {
    const segment = accessToken.split('.')[1];
    if (!segment) return null;
    const payload = JSON.parse(atob(segment.replace(/-/g, '+').replace(/_/g, '/'))) as {
      exp?: number;
    };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

let proactiveRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let syncInitialized = false;

function clearProactiveRefreshTimer() {
  if (proactiveRefreshTimer) {
    clearTimeout(proactiveRefreshTimer);
    proactiveRefreshTimer = null;
  }
}

/** Refresh shortly before the access JWT expires so agents are not kicked mid-shift. */
function scheduleProactiveAccessRefresh() {
  clearProactiveRefreshTimer();

  const { accessToken, user } = useAuthStore.getState();
  if (!accessToken || user?.impersonation) return;

  const expMs = getAccessTokenExpiryMs(accessToken);
  if (!expMs) return;

  const leadMs = 5 * 60 * 1000;
  const delay = Math.max(expMs - Date.now() - leadMs, 60_000);

  proactiveRefreshTimer = setTimeout(async () => {
    const result = await refreshAccessToken();
    if (result === 'success') {
      scheduleProactiveAccessRefresh();
      return;
    }
    if (result === 'invalid') {
      return;
    }
    // Transient failure — retry in one minute.
    proactiveRefreshTimer = setTimeout(() => scheduleProactiveAccessRefresh(), 60_000);
  }, delay);
}

/**
 * Keeps auth stable across tabs and time:
 * - Rehydrate persisted user state when another tab signs in/out.
 * - Proactively refresh access tokens before expiry.
 */
export function initAuthSessionSync() {
  if (typeof window === 'undefined' || syncInitialized) return;
  syncInitialized = true;

  window.addEventListener('storage', (event) => {
    if (event.key !== 'qp-auth-v2-user' || !event.newValue) return;
    void useAuthStore.persist.rehydrate();
  });

  useAuthStore.subscribe((state, prev) => {
    if (state.accessToken !== prev.accessToken) {
      scheduleProactiveAccessRefresh();
    }
  });

  scheduleProactiveAccessRefresh();
}
