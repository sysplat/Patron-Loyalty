import { NextRequest, NextResponse } from 'next/server';
import {
  REFRESH_TOKEN_TTL_SECONDS,
  WEB_REFRESH_COOKIE,
  WEB_SESSION_COOKIE,
  getServerApiBase,
  isSecureCookieEnv,
  resolveAccessTokenTtlSeconds,
} from '@queueplatform/shared';

type AuthTokens = { accessToken: string; refreshToken: string };

const ACCESS_TOKEN_COOKIE_MAX_AGE = resolveAccessTokenTtlSeconds();

function setAuthCookies(res: NextResponse, tokens: AuthTokens): void {
  const secure = isSecureCookieEnv();
  res.cookies.set(WEB_SESSION_COOKIE, tokens.accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_TOKEN_COOKIE_MAX_AGE,
  });
  res.cookies.set(WEB_REFRESH_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });
}

export function clearAuthCookies(res: NextResponse): void {
  const base = { httpOnly: true, secure: isSecureCookieEnv(), sameSite: 'lax' as const, path: '/' };
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
  try {
    const body = await request.json().catch(() => ({}));
    const upstream = await fetch(`${getServerApiBase()}${apiPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      setAuthCookies(response, payload.data.tokens);
      return response;
    }
    return NextResponse.json(stripTokensFromLoginPayload(payload), { status: upstream.status });
  } catch (err) {
    console.error('[auth-bff] upstream login failed', err);
    return NextResponse.json(
      {
        success: false,
        message:
          'Cannot reach the API. Run `pnpm dev:api` locally, or set API_URL in the repo root `.env` (e.g. your Railway API URL).',
      },
      { status: 503 },
    );
  }
}

export async function refreshFromCookie(request: NextRequest) {
  const refreshToken = request.cookies.get(WEB_REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    const res = NextResponse.json({ message: 'No refresh session' }, { status: 401 });
    clearAuthCookies(res);
    return res;
  }
  const upstream = await fetch(`${getServerApiBase()}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    // Only wipe cookies on explicit auth rejection — not API outages (5xx).
    if (status === 401 || status === 403) {
      clearAuthCookies(res);
    }
    return res;
  }
  const res = NextResponse.json(refreshSuccessBody(payload.data), { status: 200 });
  setAuthCookies(res, payload.data);
  return res;
}
