import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  REFRESH_TOKEN_TTL_SECONDS,
  WEB_REFRESH_COOKIE,
  WEB_SESSION_COOKIE,
  isSecureCookieEnv,
  resolveAccessTokenTtlSeconds,
} from '@queueplatform/shared';

const publicPaths = [
  '/login',
  '/signup',
  '/pricing',
  '/privacy',
  '/terms',
  '/dpa',
  '/subprocessors',
  '/patron-privacy',
  '/patron-terms',
  '/forgot-password',
  '/verify-email',
  '/reset-password',
];
const publicPrefixes = ['/portal', '/card'];
const displayPath = '/display';
const kioskPath = '/kiosk';
const trackPath = '/track';
const bookPath = '/book';

const DASHBOARD_HOME = '/overview';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Never touch Next internals, API routes, or common static assets (belt-and-suspenders with matcher).
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

  const path = pathname.replace(/\/$/, '') || '/';

  const token = request.cookies.get(WEB_SESSION_COOKIE)?.value;
  const refresh = request.cookies.get(WEB_REFRESH_COOKIE)?.value;
  const signInPaths = ['/login', '/signup'];

  const maybeRefreshForDashboard = async () => {
    if (token || !refresh) return null;
    try {
      const res = await fetch(new URL('/api/auth/refresh', request.url), {
        method: 'POST',
        headers: { cookie: request.headers.get('cookie') ?? '' },
        cache: 'no-store',
      });
      if (!res.ok) return null;
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: { accessToken?: string; refreshToken?: string };
      } | null;
      const tokens = json?.data;
      if (!tokens?.accessToken || !tokens.refreshToken) return null;

      const next = NextResponse.next();
      const secure = isSecureCookieEnv();
      next.cookies.set(WEB_SESSION_COOKIE, tokens.accessToken, {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/',
        maxAge: resolveAccessTokenTtlSeconds(),
      });
      next.cookies.set(WEB_REFRESH_COOKIE, tokens.refreshToken, {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/',
        maxAge: REFRESH_TOKEN_TTL_SECONDS,
      });
      return next;
    } catch {
      return null;
    }
  };

  // Authenticated users on login/signup → dashboard home
  if (token && signInPaths.includes(path)) {
    return NextResponse.redirect(new URL(DASHBOARD_HOME, request.url));
  }

  // Marketing landing at /
  if (path === '/') {
    if (token) return NextResponse.redirect(new URL(DASHBOARD_HOME, request.url));
    return NextResponse.next();
  }

  // Allow public paths (legal, auth recovery, pricing, etc.)
  if (publicPaths.includes(path)) return NextResponse.next();
  if (publicPrefixes.some((prefix) => pathname.startsWith(prefix))) return NextResponse.next();

  // Allow display screen, kiosk, track, and booking routes
  if (pathname.startsWith(displayPath)) return NextResponse.next();
  if (pathname.startsWith(kioskPath)) return NextResponse.next();
  if (pathname.startsWith(trackPath)) return NextResponse.next();
  if (pathname.startsWith(bookPath)) return NextResponse.next();

  // Loyalty app routes live at `/`, `/patrons`, etc. (not under `/dashboard`).
  // Require the HttpOnly session cookie for every non-public path.
  if (!token) {
    const refreshed = await maybeRefreshForDashboard();
    if (refreshed) return refreshed;
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Align with Next.js guidance: skip internals, HMR, and favicon.
    '/((?!api|_next/static|_next/image|_next/webpack-hmr|favicon.ico).*)',
  ],
};
