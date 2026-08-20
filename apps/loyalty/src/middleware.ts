import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  REFRESH_TOKEN_TTL_SECONDS,
  WEB_REFRESH_COOKIE,
  WEB_SESSION_COOKIE,
  resolveAccessTokenTtlSeconds,
  sessionCookieOptions,
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
const publicPrefixes = ['/portal', '/card', '/refer'];

const DASHBOARD_HOME = '/overview';

/** Preserve the browser hostname when proxied (Cloudflare → Railway). */
function publicRequestUrl(request: NextRequest): URL {
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || request.headers.get('host');
  if (!host) return new URL(request.url);
  const url = new URL(request.url);
  url.host = host;
  url.protocol = `${request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')}:`;
  return url;
}

export async function middleware(request: NextRequest) {
  const publicUrl = publicRequestUrl(request);
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
      const res = await fetch(new URL('/api/auth/refresh', publicUrl), {
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
      next.cookies.set(
        WEB_SESSION_COOKIE,
        tokens.accessToken,
        sessionCookieOptions(resolveAccessTokenTtlSeconds()),
      );
      next.cookies.set(
        WEB_REFRESH_COOKIE,
        tokens.refreshToken,
        sessionCookieOptions(REFRESH_TOKEN_TTL_SECONDS),
      );
      return next;
    } catch {
      return null;
    }
  };

  // Authenticated users on login/signup → dashboard home
  if (token && signInPaths.includes(path)) {
    return NextResponse.redirect(new URL(DASHBOARD_HOME, publicUrl));
  }

  // Marketing landing at /
  if (path === '/') {
    if (token) return NextResponse.redirect(new URL(DASHBOARD_HOME, publicUrl));
    return NextResponse.next();
  }

  // Allow public paths (legal, auth recovery, pricing, etc.)
  if (publicPaths.includes(path)) return NextResponse.next();
  if (publicPrefixes.some((prefix) => pathname.startsWith(prefix))) return NextResponse.next();

  // Loyalty app routes live at `/`, `/patrons`, etc. (not under `/dashboard`).
  // Require the HttpOnly session cookie for every non-public path.
  if (!token) {
    const refreshed = await maybeRefreshForDashboard();
    if (refreshed) return refreshed;
    return NextResponse.redirect(new URL('/login', publicUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Align with Next.js guidance: skip internals, HMR, and favicon.
    '/((?!api|_next/static|_next/image|_next/webpack-hmr|favicon.ico).*)',
  ],
};
