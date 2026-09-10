import { NextRequest, NextResponse } from 'next/server';
import {
  REFRESH_TOKEN_TTL_SECONDS,
  ADMIN_REFRESH_COOKIE,
  ADMIN_SESSION_COOKIE,
  getServerApiBase,
  isSecureCookieEnv,
  resolveAccessTokenTtlSeconds,
} from '@queueplatform/shared';

type AuthTokens = { accessToken: string; refreshToken: string };

const ACCESS_TOKEN_COOKIE_MAX_AGE = resolveAccessTokenTtlSeconds();

function setAuthCookies(res: NextResponse, tokens: AuthTokens): void {
  const secure = isSecureCookieEnv();
  res.cookies.set(ADMIN_SESSION_COOKIE, tokens.accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_TOKEN_COOKIE_MAX_AGE,
  });
  res.cookies.set(ADMIN_REFRESH_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });
}

export function clearAuthCookies(res: NextResponse): void {
  const base = { httpOnly: true, secure: isSecureCookieEnv(), sameSite: 'lax' as const, path: '/' };
  res.cookies.set(ADMIN_SESSION_COOKIE, '', { ...base, maxAge: 0 });
  res.cookies.set(ADMIN_REFRESH_COOKIE, '', { ...base, maxAge: 0 });
}

async function parseJson(res: Response): Promise<unknown> {
  return res.json().catch(() => ({}));
}

export async function proxyLogin(request: NextRequest, apiPath: '/auth/login' | '/auth/login/2fa') {
  const body = await request.json().catch(() => ({}));
  const upstream = await fetch(`${getServerApiBase()}${apiPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const payload = (await parseJson(upstream)) as {
    success?: boolean;
    data?: { tokens?: AuthTokens };
    message?: string;
    error?: string;
  };
  const response = NextResponse.json(payload, { status: upstream.status });
  if (upstream.ok && payload?.data?.tokens?.accessToken && payload.data.tokens.refreshToken) {
    setAuthCookies(response, payload.data.tokens);
  }
  return response;
}

export async function refreshFromCookie(request: NextRequest) {
  const refreshToken = request.cookies.get(ADMIN_REFRESH_COOKIE)?.value;
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
    data?: AuthTokens;
    message?: string;
  };
  if (!upstream.ok || !payload?.data?.accessToken || !payload?.data?.refreshToken) {
    const status = upstream.status || 401;
    const res = NextResponse.json(payload, { status });
    if (status === 401 || status === 403) {
      clearAuthCookies(res);
    }
    return res;
  }
  const res = NextResponse.json({ success: true, data: payload.data }, { status: 200 });
  setAuthCookies(res, payload.data);
  return res;
}
