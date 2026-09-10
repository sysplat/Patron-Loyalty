import { useAuthStore } from '@/lib/auth-store';
import { captureApiError, syncSentryAuthContext } from '@/lib/sentry-client';
import { createApiClient, ApiError } from '@queueplatform/frontend-core';
import { formatRequestIdRef } from '@queueplatform/shared';

export { ApiError };

/**
 * Clears the local auth session and redirects to /login.
 * Called automatically when any API response returns 401.
 * No-ops during server-side rendering.
 */
function handleUnauthenticated() {
  if (typeof window === 'undefined') return;
  useAuthStore.getState().logout();

  // Only redirect (refresh) if we aren't already on the login page
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
  }
}

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshAccessToken(): Promise<'success' | 'invalid' | 'unavailable'> {
  if (typeof window === 'undefined') return 'unavailable';

  const state = useAuthStore.getState();
  if (state.user?.impersonation) {
    state.exitImpersonation();
    if (useAuthStore.getState().accessToken && !useAuthStore.getState().user?.impersonation) {
      return 'success';
    }
  }

  if (refreshInFlight) {
    return (await refreshInFlight) ? 'success' : 'unavailable';
  }

  refreshInFlight = (async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return false;

      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: { accessToken: string; refreshToken?: string };
      } | null;
      const data = json?.data;
      if (!data?.accessToken) return false;

      useAuthStore.getState().setTokensFromRefresh(data.accessToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return (await refreshInFlight) ? 'success' : 'unavailable';
}

const client = createApiClient({
  getAuthToken: () => {
    if (typeof window !== 'undefined') {
      syncSentryAuthContext(useAuthStore.getState().user);
    }
    return useAuthStore.getState().accessToken;
  },
  onUnauthenticated: handleUnauthenticated,
  refreshAccessToken: tryRefreshAccessToken,
  onApiError: (error, context) => {
    captureApiError(error, {
      path: context.path,
      method: context.method,
      status: error.status,
      code: error.code,
      requestId: context.requestId,
      details: error.details,
    });
  },
  onServerErrorToast: (message, meta) => {
    const ref = formatRequestIdRef(meta?.requestId);
    const status = meta?.status ?? 500;
    void import('sonner').then(({ toast }) =>
      toast.error(message, {
        id: meta?.code
          ? `api-err:${meta.code}`
          : meta?.requestId
            ? `api-err:${formatRequestIdRef(meta.requestId)}`
            : status >= 500
              ? 'api-5xx'
              : 'api-4xx',
        description: meta?.requestId
          ? `Support ID: ${meta.requestId}${ref && ref !== meta.requestId ? ` (short: ${ref})` : ''}`
          : undefined,
        duration: status >= 500 ? 12_000 : 8_000,
      }),
    );
  },
});

export const api = {
  get: client.get,
  post: client.post,
  put: client.put,
  patch: client.patch,
  delete: client.delete,
};
