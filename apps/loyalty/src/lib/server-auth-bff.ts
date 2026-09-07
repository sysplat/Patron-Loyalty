import { NextRequest, NextResponse } from 'next/server';
import {
  REFRESH_TOKEN_TTL_SECONDS,
  WEB_REFRESH_COOKIE,
  WEB_SESSION_COOKIE,
  getServerApiBase,
  newClientRequestId,
  resolveAccessTokenTtlSeconds,
  sessionCookieOptions,
} from '@queueplatform/shared';

type AuthTokens = { accessToken: string; refreshToken: string };

const ACCESS_TOKEN_COOKIE_MAX_AGE = resolveAccessTokenTtlSeconds();

function setAuthCookies(res: NextResponse, tokens: AuthTokens): void {
  res.cookies.set(
    WEB_SESSION_COOKIE,
    tokens.accessToken,
    sessionCookieOptions(ACCESS_TOKEN_COOKIE_MAX_AGE),
  );
  res.cookies.set(
    WEB_REFRESH_COOKIE,
    tokens.refreshToken,
    sessionCookieOptions(REFRESH_TOKEN_TTL_SECONDS),
  );
}

export function clearAuthCookies(res: NextResponse): void {
  const base = sessionCookieOptions(0);
  res.cookies.set(WEB_SESSION_COOKIE, '', { ...base, maxAge: 0 });
  res.cookies.set(WEB_REFRESH_COOKIE, '', { ...base, maxAge: 0 });
}

async function parseJson(res: Response): Promise<unknown> {
  return res.json().catch(() => ({}));
}

/** Remove JWT material from login JSON — cookies are the browser session carrier. */
function stripTokensFromLoginPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const data = payload.data;
  if (!data || typeof data !== 'object') return payload;
  const nextData = { ...(data as Record<string, unknown>) };
  delete nextData.tokens;
  return { ...payload, data: nextData };
}

/** Remove JWT material from refresh JSON — cookies + `/api/auth/token` sync carry the session. */
function stripTokensFromRefreshPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const data = payload.data;
  if (!data || typeof data !== 'object') return payload;
  const nextData = { ...(data as Record<string, unknown>) };
  delete nextData.accessToken;
  delete nextData.refreshToken;
  return { ...payload, data: nextData };
}

function refreshSuccessBody(
  data: AuthTokens & { platformOperator?: boolean },
): Record<string, unknown> {
  const body: Record<string, unknown> = { success: true, data: {} };
  if (typeof data.platformOperator === 'boolean') {
    (body.data as Record<string, unknown>).platformOperator = data.platformOperator;
  }
  return body;
}

export async function proxyLogin(request: NextRequest, apiPath: '/auth/login' | '/auth/login/2fa') {
  const requestId = request.headers.get('x-request-id')?.trim() || newClientRequestId();
  try {
    const body = await request.json().catch(() => ({}));
    const upstream = await fetch(`${getServerApiBase()}${apiPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const payload = (await parseJson(upstream)) as {
      success?: boolean;
      data?: { tokens?: AuthTokens; [key: string]: unknown };
      message?: string;
      error?: string;
    };
    if (upstream.ok && payload?.data?.tokens?.accessToken && payload.data.tokens.refreshToken) {
      const response = NextResponse.json(stripTokensFromLoginPayload(payload), {
        status: upstream.status,
      });
      response.headers.set('X-Request-ID', requestId);
      setAuthCookies(response, payload.data.tokens);
      return response;
    }
    const errorResponse = NextResponse.json(stripTokensFromLoginPayload(payload), {
      status: upstream.status,
    });
    errorResponse.headers.set('X-Request-ID', requestId);
    return errorResponse;
  } catch (err) {
    console.error('[auth-bff] upstream login failed', err);
    const res = NextResponse.json(
      {
        success: false,
        message:
          'Cannot reach the API. Run `pnpm dev:api` locally, or set API_URL in the repo root `.env` (e.g. your Railway API URL).',
      },
      { status: 503 },
    );
    res.headers.set('X-Request-ID', requestId);
    return res;
  }
}

export async function refreshFromCookie(request: NextRequest) {
  const refreshToken = request.cookies.get(WEB_REFRESH_COOKIE)?.value;
  const requestId = request.headers.get('x-request-id')?.trim() || newClientRequestId();
  if (!refreshToken) {
    const res = NextResponse.json({ message: 'No refresh session' }, { status: 401 });
    res.headers.set('X-Request-ID', requestId);
    clearAuthCookies(res);
    return res;
  }
  const upstream = await fetch(`${getServerApiBase()}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': requestId,
    },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  });
  const payload = (await parseJson(upstream)) as {
    success?: boolean;
    data?: AuthTokens & { platformOperator?: boolean };
    message?: string;
  };
  if (!upstream.ok || !payload?.data?.accessToken || !payload?.data?.refreshToken) {
    const status = upstream.status || 401;
    const res = NextResponse.json(
      stripTokensFromRefreshPayload(payload as Record<string, unknown>),
      {
        status,
      },
    );
    res.headers.set('X-Request-ID', requestId);
    // Only wipe cookies on explicit auth rejection — not API outages (5xx).
    if (status === 401 || status === 403) {
      clearAuthCookies(res);
    }
    return res;
  }
  const res = NextResponse.json(refreshSuccessBody(payload.data), { status: 200 });
  res.headers.set('X-Request-ID', requestId);
  setAuthCookies(res, payload.data);
  return res;
}
