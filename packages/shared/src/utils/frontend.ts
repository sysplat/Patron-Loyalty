export const WEB_SESSION_COOKIE = 'qp-session';
export const WEB_REFRESH_COOKIE = 'qp-refresh';
export const ADMIN_SESSION_COOKIE = 'qp-admin-session';
export const ADMIN_REFRESH_COOKIE = 'qp-admin-refresh';
export const DISPLAY_SESSION_COOKIE = 'qp-display-session';
export const DISPLAY_DEVICE_COOKIE = 'qp-display-device';
export const DISPLAY_API_KEY_COOKIE = 'qp-display-api-key';

/** Default matches API `JWT_ACCESS_TTL` when unset (14_400s / 4h). */
export const ACCESS_TOKEN_TTL_SECONDS_DEFAULT = 14_400;

/** Fallback when `JWT_ACCESS_TTL` is not available (e.g. client bundle). */
export const ACCESS_TOKEN_TTL_SECONDS = ACCESS_TOKEN_TTL_SECONDS_DEFAULT;

/**
 * Access-token cookie lifetime — should match API `JWT_ACCESS_TTL`.
 * Server BFF routes should call this with `process.env.JWT_ACCESS_TTL`.
 */
export function resolveAccessTokenTtlSeconds(envValue?: string): number {
  const raw = envValue ?? (typeof process !== 'undefined' ? process.env.JWT_ACCESS_TTL : undefined);
  if (raw) {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return ACCESS_TOKEN_TTL_SECONDS_DEFAULT;
}

export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
/** Short-lived display JWT cookie — refreshed automatically via apiKey. */
export const DISPLAY_SESSION_TTL_SECONDS = 60 * 60 * 24;
/** Long-lived device + apiKey cookies (rolling on each successful refresh). */
export const DISPLAY_CREDENTIAL_TTL_SECONDS = 60 * 60 * 24 * 365;

export function isSecureCookieEnv(): boolean {
  return process.env.NODE_ENV === 'production';
}

/** Ensures browser/server clients target Nest URI versioning (`/api/v1/...`). */
export function normalizeApiV1Base(url: string): string {
  const base = url.replace(/\/$/, '');
  if (base.startsWith('/')) {
    return base.endsWith('/api/v1') ? base : `${base}/api/v1`.replace(/\/+/g, '/');
  }
  return base.endsWith('/api/v1') ? base : `${base}/api/v1`;
}

export function getApiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
  return normalizeApiV1Base(raw);
}

/** Server-side BFF routes: prefer API_URL from the monorepo root when NEXT_PUBLIC_API_URL is unset. */
export function getServerApiBase(): string {
  const apiUrl = process.env.API_URL?.replace(/\/$/, '');
  if (apiUrl) {
    return normalizeApiV1Base(apiUrl);
  }
  return getApiBase();
}

type ApiErrorBody = {
  message?: string | string[];
  error?: string | { code?: string; message?: string; details?: Record<string, unknown> };
};

function readApiErrorBody(data: unknown): ApiErrorBody | null {
  if (!data || typeof data !== 'object') return null;
  return data as ApiErrorBody;
}

/** Reads `error.code` from GlobalExceptionFilter JSON (`{ success: false, error: { code, message } }`). */
export function getApiErrorCode(data: unknown): string | undefined {
  const body = readApiErrorBody(data);
  const err = body?.error;
  if (err && typeof err === 'object' && typeof err.code === 'string') return err.code;
  return undefined;
}

/** Reads `error.details` when present. */
export function getApiErrorDetails(data: unknown): Record<string, unknown> | undefined {
  const body = readApiErrorBody(data);
  const err = body?.error;
  if (err && typeof err === 'object' && err.details && typeof err.details === 'object') {
    return err.details as Record<string, unknown>;
  }
  return undefined;
}

export function extractErrorMessage(data: unknown, statusText: string): string {
  const body = readApiErrorBody(data);
  if (!body) return statusText;

  const errObj = body.error && typeof body.error === 'object' ? body.error : null;
  const validationErrors = errObj?.details?.validationErrors;
  if (
    Array.isArray(validationErrors) &&
    validationErrors.length > 0 &&
    typeof validationErrors[0] === 'string'
  ) {
    return validationErrors[0];
  }

  if (typeof body.message === 'string') return body.message;
  if (Array.isArray(body.message) && body.message.length > 0) return body.message[0] ?? statusText;
  if (typeof body.error === 'string') return body.error;
  if (errObj && typeof errObj.message === 'string') {
    return errObj.message;
  }
  return statusText;
}
