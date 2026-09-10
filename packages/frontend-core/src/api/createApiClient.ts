import {
  extractErrorMessage,
  formatUserFacingApiError,
  getApiErrorCode,
  getApiErrorDetails,
  getApiBase,
  getApiRequestId,
} from '@queueplatform/shared';

const API_BASE = getApiBase();

export interface FetchOptions extends RequestInit {
  token?: string;
  skipAuth?: boolean;
  showErrorToast?: boolean;
  retryGet?: boolean;
}

export type RefreshSessionResult = 'success' | 'invalid' | 'unavailable';

export class ApiError extends Error {
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

const TRANSIENT_GET_STATUSES = new Set([502, 503, 504, 429]);

function shouldRetryGet(method: string, status: number): boolean {
  return method === 'GET' && TRANSIENT_GET_STATUSES.has(status);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type ApiClientConfig = {
  getAuthToken: () => string | null | undefined;
  onUnauthenticated: (path: string) => void;
  refreshAccessToken: () => Promise<RefreshSessionResult>;
  onApiError?: (
    error: ApiError,
    options: { path: string; method: string; requestId?: string },
  ) => void;
  onServerErrorToast?: (
    message: string,
    meta?: { code?: string; requestId?: string; status?: number },
  ) => void;
  /** Fired after a successful API response (2xx). Useful to clear deploy banners. */
  onRequestSuccess?: (meta: { path: string; method: string }) => void;
};

export function createApiClient(config: ApiClientConfig) {
  async function finishOk<T>(res: Response, meta: { path: string; method: string }): Promise<T> {
    config.onRequestSuccess?.(meta);
    if (res.status === 204) return undefined as T;
    return res.json();
  }

  async function request<T>(path: string, options: FetchOptions = {}): Promise<T> {
    const {
      token: manualToken,
      skipAuth,
      showErrorToast = true,
      retryGet = true,
      ...fetchOptions
    } = options;
    const method = String(fetchOptions.method ?? 'GET').toUpperCase();
    const successMeta = { path, method };

    const storeToken = config.getAuthToken();
    const manualTokenResolved =
      typeof manualToken === 'string' && manualToken.trim().length > 0 ? manualToken : undefined;
    const token = skipAuth ? undefined : (manualTokenResolved ?? storeToken);
    const usedManualToken = Boolean(manualTokenResolved);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(fetchOptions.headers as Record<string, string>),
    };

    // Allow explicitly omitting Content-Type by passing an empty string
    // (useful for FormData where the browser must auto-generate the boundary)
    if (headers['Content-Type'] === '') {
      delete headers['Content-Type'];
    }

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
          return finishOk<T>(res, successMeta);
        }
        data = await res.json().catch(() => ({}));
      }
    }

    if (!res.ok) {
      if (res.status === 401 && token) {
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
          refreshResult = await config.refreshAccessToken();
          if (refreshResult === 'success') {
            const next = config.getAuthToken();
            if (next) {
              headers['Authorization'] = `Bearer ${next}`;
              res = await doFetch();
              if (res.ok) {
                return finishOk<T>(res, successMeta);
              }
              data = await res.json().catch(() => ({}));
            }
          }
        }

        if (res.status === 401) {
          if (refreshResult === 'invalid' || !canTryRefresh) {
            config.onUnauthenticated(path);
          }
        }
      }

      const rawMessage = extractErrorMessage(data, res.statusText);
      const code = getApiErrorCode(data);
      const headerRequestId = res.headers.get('x-request-id')?.trim();
      const requestId =
        getApiRequestId(data) ||
        (headerRequestId && headerRequestId !== 'none' ? headerRequestId : undefined);
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
        res.status >= 400 &&
        res.status !== 401 &&
        !path.includes('/health')
      ) {
        config.onServerErrorToast?.(message, {
          code: code || undefined,
          requestId: requestId || undefined,
          status: res.status,
        });
      }

      config.onApiError?.(apiError, {
        path,
        method: fetchOptions.method ?? 'GET',
        requestId: requestId || undefined,
      });

      throw apiError;
    }

    return finishOk<T>(res, successMeta);
  }

  return {
    request,
    get: <T>(path: string, opts?: FetchOptions) => request<T>(path, { ...opts, method: 'GET' }),
    post: <T>(path: string, body?: any, opts?: FetchOptions) =>
      request<T>(path, { ...opts, method: 'POST', body: body ? JSON.stringify(body) : undefined }),
    postForm: <T>(path: string, formData: FormData, opts?: FetchOptions) => {
      return request<T>(path, {
        ...opts,
        method: 'POST',
        body: formData,
        headers: { ...(opts?.headers as Record<string, string>), 'Content-Type': '' } as any,
      });
    },
    put: <T>(path: string, body?: any, opts?: FetchOptions) =>
      request<T>(path, { ...opts, method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
    patch: <T>(path: string, body?: any, opts?: FetchOptions) =>
      request<T>(path, { ...opts, method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
    delete: <T>(path: string, opts?: FetchOptions) =>
      request<T>(path, { ...opts, method: 'DELETE' }),
  };
}
