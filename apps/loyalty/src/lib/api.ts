import { useAuthStore } from '@/lib/auth-store';
import { coordinateRefresh, type RefreshSessionResult } from '@/lib/auth-refresh-coordination';
import { captureApiError, syncSentryAuthContext } from '@/lib/sentry-client';
import {
  extractErrorMessage,
  formatUserFacingApiError,
  getApiErrorCode,
  getApiErrorDetails,
  getApiBase,
  getApiRequestId,
} from '@queueplatform/shared';

const API_BASE = getApiBase();

interface FetchOptions extends RequestInit {
  token?: string;
  /** When true, never attach the session JWT (kiosk / TV / other public pages). */
  skipAuth?: boolean;
  /** Show a toast for server errors (default true in the browser). */
  showErrorToast?: boolean;
  /** Retry idempotent GET once on transient gateway errors (default true). */
  retryGet?: boolean;
}

const TRANSIENT_GET_STATUSES = new Set([502, 503, 504, 429]);

function shouldRetryGet(method: string, status: number): boolean {
  return method === 'GET' && TRANSIENT_GET_STATUSES.has(status);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class ApiError extends Error {
  status: number;
  data: any;
  code?: string;
  details?: Record<string, unknown>;
  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
    this.code = getApiErrorCode(data);
    this.details = getApiErrorDetails(data);
  }
}

/**
 * Clears the local auth session and usually redirects to /login.
 * Called automatically when any API response returns 401.
 * No-ops during server-side rendering.
 *
 * Exceptions (no forced redirect to /login; see body):
 * - `/dashboard/setup-2fa` — avoids 2FA setup redirect loops.
 * - `/forgot-password`, `/reset-password`, `/verify-email`, `/signup` — account recovery;
 *   still clears session so stale JWTs do not keep firing 401s.
 */
function handleUnauthenticated() {
  if (typeof window === 'undefined') return;

  const path = window.location.pathname.replace(/\/$/, '') || '/';

  // Do not forcibly log out while the user is completing mandatory 2FA
  // setup — the token is valid but the page fires multiple API calls at
  // once and a single 401 must not destroy the session.
  const isSetupFlow = path.startsWith('/dashboard/setup-2fa');
  if (isSetupFlow) return;

  // Password / access recovery: clear stale session but stay on this page so
  // the user can finish the flow (otherwise a stray 401 boots them to /login).
  const isAccountRecoveryPage =
    path === '/forgot-password' ||
    path === '/reset-password' ||
    path === '/verify-email' ||
    path === '/signup';
  if (isAccountRecoveryPage) {
    useAuthStore.getState().logout();
    return;
  }

  useAuthStore.getState().logout();

  // Only redirect (refresh) if we aren't already on the login page
  if (!path.startsWith('/login')) {
    window.location.href = '/login';
  }
}

export type { RefreshSessionResult };

let refreshInFlight: Promise<RefreshSessionResult> | null = null;

/**
 * Single-flight refresh.
 * - `success` — new tokens stored (other tabs pick them up via storage event).
 * - `invalid` — refresh token revoked/expired; caller should log out.
 * - `unavailable` — network/API blip; do not log the user out.
 */
export async function refreshAccessToken(): Promise<RefreshSessionResult> {
  if (typeof window === 'undefined') return 'unavailable';
  if (useAuthStore.getState().user?.impersonation) return 'invalid';

  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      return await coordinateRefresh(async () => {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        });

        if (res.status === 401 || res.status === 403) return 'invalid';
        if (!res.ok) return 'unavailable';

        const json = (await res.json().catch(() => null)) as {
          success?: boolean;
          data?: { accessToken: string; refreshToken: string; platformOperator?: boolean };
        } | null;
        const data = json?.data;
        if (!data?.accessToken) return 'unavailable';

        useAuthStore.getState().setTokensFromRefresh(data.accessToken);
        if (typeof data.platformOperator === 'boolean') {
          useAuthStore.getState().updateUser({ platformOperator: data.platformOperator });
        }
        return 'success';
      });
    } catch {
      return 'unavailable';
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/**
 * Central fetch wrapper for all API calls from the Next.js frontend.
 *
 * - Auto-injects the JWT access token from the auth store unless overridden.
 * - On 401 with a Bearer token, attempts `/auth/refresh` once then retries the request.
 * - Normalizes error responses into `ApiError` with a human-readable message.
 * - Triggers logout and redirect on unrecoverable 401 responses.
 * - Returns `undefined` on 204 No Content.
 *
 * All HTTP method helpers on the `api` export go through this function.
 * Never call `fetch()` directly from page/component code.
 */
async function request<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const {
    token: manualToken,
    skipAuth,
    showErrorToast = true,
    retryGet = true,
    ...fetchOptions
  } = options;
  const method = (fetchOptions.method ?? 'GET').toUpperCase();

  const storeToken = useAuthStore.getState().accessToken;
  const token = skipAuth ? undefined : (manualToken ?? storeToken);
  const usedManualToken = Boolean(manualToken);

  if (typeof window !== 'undefined') {
    syncSentryAuthContext(useAuthStore.getState().user);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = path.startsWith('/api/') ? path : `${API_BASE}${path}`;
  const doFetch = () =>
    fetch(url, {
      ...fetchOptions,
      headers,
      credentials: 'include',
    });

  let res = await doFetch();
  let data: unknown = {};

  if (!res.ok) {
    data = await res.json().catch(() => ({}));

    if (retryGet && shouldRetryGet(method, res.status)) {
      await sleep(400);
      res = await doFetch();
      if (res.ok) {
        if (res.status === 204) return undefined as T;
        return res.json();
      }
      data = await res.json().catch(() => ({}));
    }
  }

  if (!res.ok) {
    if (res.status === 401 && token) {
      // 401 without a sent Bearer means "this request was rejected as anonymous" — not
      // "your session expired". Never clear a logged-in session for skipAuth/public calls.
      const canTryRefresh =
        !skipAuth &&
        !usedManualToken &&
        path !== '/auth/refresh' &&
        path !== '/auth/login' &&
        path !== '/auth/login/2fa' &&
        path !== '/api/auth/refresh' &&
        path !== '/api/auth/login' &&
        path !== '/api/auth/login/2fa';

      let refreshResult: RefreshSessionResult = 'invalid';
      if (canTryRefresh) {
        refreshResult = await refreshAccessToken();
        if (refreshResult === 'success') {
          const next = useAuthStore.getState().accessToken;
          if (next) {
            headers['Authorization'] = `Bearer ${next}`;
            res = await doFetch();
            if (res.ok) {
              if (res.status === 204) return undefined as T;
              return res.json();
            }
            data = await res.json().catch(() => ({}));
          }
        }
      }

      if (res.status === 401) {
        // Only end the session when refresh is impossible or explicitly rejected.
        // Transient refresh failures (API restart, offline) must not force login.
        if (refreshResult === 'invalid' || !canTryRefresh) {
          handleUnauthenticated();
        }
      }
    }

    const rawMessage = extractErrorMessage(data, res.statusText);
    const code = getApiErrorCode(data);
    const requestId = getApiRequestId(data);
    const message = formatUserFacingApiError({
      status: res.status,
      message: rawMessage,
      code,
      requestId,
    });
    const apiError = new ApiError(res.status, message, data);

    if (
      typeof window !== 'undefined' &&
      showErrorToast &&
      res.status >= 500 &&
      !path.includes('/health')
    ) {
      void import('sonner').then(({ toast }) => toast.error(message));
    }

    captureApiError(apiError, {
      path,
      method: fetchOptions.method ?? 'GET',
      status: res.status,
      code: apiError.code,
      requestId: requestId || undefined,
      details: apiError.details,
    });

    throw apiError;
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string, opts?: FetchOptions) => request<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: any, opts?: FetchOptions) =>
    request<T>(path, { ...opts, method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: any, opts?: FetchOptions) =>
    request<T>(path, { ...opts, method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: any, opts?: FetchOptions) =>
    request<T>(path, { ...opts, method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string, opts?: FetchOptions) => request<T>(path, { ...opts, method: 'DELETE' }),
};

export { ApiError };
