import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  ADMIN_REFRESH_COOKIE,
  ADMIN_SESSION_COOKIE,
  REFRESH_TOKEN_TTL_SECONDS,
  isSecureCookieEnv,
  resolveAccessTokenTtlSeconds,
} from '@queueplatform/shared';

const publicPaths = ['/login'];

type RefreshPayload = {
  success?: boolean;
  data?: { accessToken?: string; refreshToken?: string };
};

async function tryRefreshSessionCookie(request: NextRequest): Promise<RefreshPayload | null> {
  try {
    const res = await fetch(new URL('/api/auth/refresh', request.url), {
      method: 'POST',
      headers: {
        cookie: request.headers.get('cookie') ?? '',
      },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json().catch(() => null)) as RefreshPayload | null;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const path = pathname.replace(/\/$/, '') || '/';
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const refresh = request.cookies.get(ADMIN_REFRESH_COOKIE)?.value;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/icon') ||
    /\.(?:ico|png|jpg|jpeg|gif|svg|webp|woff2?|ttf|eot|txt|xml|webmanifest|css|js|map)$/i.test(
      pathname,
    )
  ) {
    return NextResponse.next();
  }

  // If the access token cookie expired but a refresh cookie exists, refresh transparently.
  // This prevents being kicked back to /login after a few hours of inactivity.
  if (!token && refresh && !publicPaths.includes(path)) {
    const payload = await tryRefreshSessionCookie(request);
    const tokens = payload?.data;
    if (tokens?.accessToken && tokens.refreshToken) {
      const res = NextResponse.next();
      const secure = isSecureCookieEnv();
      res.cookies.set(ADMIN_SESSION_COOKIE, tokens.accessToken, {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/',
        maxAge: resolveAccessTokenTtlSeconds(),
      });
      res.cookies.set(ADMIN_REFRESH_COOKIE, tokens.refreshToken, {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/',
        maxAge: REFRESH_TOKEN_TTL_SECONDS,
      });
      return res;
    }
  }

  if (path === '/' && token) {
    return NextResponse.redirect(new URL('/pulse', request.url));
  }

  if (token && publicPaths.includes(path)) {
    return NextResponse.redirect(new URL('/pulse', request.url));
  }

  if (!token && !publicPaths.includes(path)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|_next/webpack-hmr|favicon.ico).*)'],
};
