'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { authPersistHasHydrated, onAuthPersistHydrated, useAuthStore } from '@/lib/auth-store';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import {
  Building2,
  Activity,
  Headphones,
  LogOut,
  Server,
  ShieldAlert,
  Users,
  KeyRound,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  formatPlatformApiErrorMessage,
  PlatformTwoFaApiMissingScreen,
  PlatformTwoFaStatusErrorScreen,
  TwoFAEnrollmentWall,
} from '@/components/layout/two-fa-wall';
import { useTabVisible } from '@/lib/use-tab-visible';
import {
  isImpersonationEndedMessage,
  restoreAdminSessionAfterImpersonation,
} from '@/lib/impersonation-exit-sync';
import { QlessqLogoMark, QlessqWordmark } from '@/components/brand';

type TwoFAStatus = { enabled: boolean; enrollmentPending: boolean };

const THEME_STORAGE_KEY = 'queueplatform.dashboard.theme.v1';
const SIDEBAR_COLLAPSED_KEY = 'queueplatform.dashboard.sidebar.collapsed';

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.accessToken);
  const logout = useAuthStore((s) => s.logout);
  const setTokensFromRefresh = useAuthStore((s) => s.setTokensFromRefresh);
  const tabVisible = useTabVisible();

  const queryClient = useQueryClient();
  const {
    data: twoFAStatus,
    isLoading: twoFALoading,
    isError: twoFAIsError,
    error: twoFAReqError,
  } = useQuery({
    queryKey: ['platform', '2fa', 'status'],
    queryFn: () =>
      api
        .get<{
          success: boolean;
          data: TwoFAStatus;
        }>('/platform-admin/2fa/status', { token: token! })
        .then((r) => r?.data),
    enabled: !!token,
    staleTime: 30_000,
    retry: (failureCount, err) => {
      if (err instanceof ApiError && err.status === 404) return false;
      return failureCount < 2;
    },
  });

  const { data: supportCountData } = useQuery({
    queryKey: ['admin-support-unread-count'],
    queryFn: () =>
      api
        .get<{
          success: boolean;
          data: { count: number };
        }>('/platform-admin/support/unread-count', { token: token! })
        .then((r) => r?.data),
    enabled: !!token && twoFAStatus?.enabled === true,
    staleTime: 30_000,
    refetchInterval: tabVisible ? 60_000 : false,
  });

  const unreadCount = supportCountData?.count || 0;

  const [hydrated, setHydrated] = useState(false);
  const [persistReady, setPersistReady] = useState(authPersistHasHydrated);
  const [dashboardTheme, setDashboardTheme] = useState<'light' | 'dark'>('light');
  const [sessionChecked, setSessionChecked] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Ref for announcing unread count changes to screen readers
  const prevUnreadCountRef = useRef(unreadCount);

  useEffect(() => {
    setHydrated(true);
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') {
      setDashboardTheme(stored);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDashboardTheme('dark');
    }

    const storedSidebar = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (storedSidebar === 'true') {
      setSidebarCollapsed(true);
    }
  }, []);

  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
  };

  useEffect(() => {
    const root = window.document.documentElement;
    if (dashboardTheme === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
  }, [dashboardTheme]);

  const toggleTheme = () => {
    const next = dashboardTheme === 'light' ? 'dark' : 'light';
    setDashboardTheme(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
  };

  useEffect(() => {
    return onAuthPersistHydrated(() => setPersistReady(true));
  }, []);

  useEffect(() => {
    function onImpersonationEnded(event: MessageEvent) {
      if (!isImpersonationEndedMessage(event.data)) return;
      void restoreAdminSessionAfterImpersonation();
    }
    window.addEventListener('message', onImpersonationEnded);
    return () => window.removeEventListener('message', onImpersonationEnded);
  }, []);

  useEffect(() => {
    if (!hydrated || !persistReady || token || sessionChecked) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/session', { credentials: 'include' });
        const payload = (await res.json().catch(() => null)) as {
          authenticated?: boolean;
          data?: { accessToken?: string };
        } | null;
        if (!cancelled && payload?.authenticated && payload?.data?.accessToken) {
          const state = useAuthStore.getState();
          if (!state.user) {
            await fetch('/api/auth/logout', {
              method: 'POST',
              credentials: 'include',
              keepalive: true,
              signal: AbortSignal.timeout(1500),
            }).catch(() => undefined);
          } else {
            if (state.user.impersonation) {
              state.exitImpersonation();
            }
            setTokensFromRefresh(payload.data.accessToken);
            const user = useAuthStore.getState().user;
            if (user?.impersonation) {
              useAuthStore.getState().setAuth(payload.data.accessToken, {
                ...user,
                impersonation: undefined,
                roleSimulation: undefined,
                simulatedBranchId: undefined,
                simulatedBranchName: undefined,
              });
            }
          }
        }
      } finally {
        if (!cancelled) setSessionChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, persistReady, token, sessionChecked, setTokensFromRefresh]);

  const clientReady = hydrated && persistReady;

  useEffect(() => {
    if (!clientReady) return;
    if (!token && !sessionChecked) return;
    if (!user || !user.platformOperator) {
      router.push('/login');
    }
  }, [clientReady, user, router, token, sessionChecked]);

  // Track unread count changes so screen reader can announce them
  useEffect(() => {
    prevUnreadCountRef.current = unreadCount;
  }, [unreadCount]);

  // Loyalty admin: no QMS coupons/partners/announcements (separate product console).
  const NAV = [
    { href: '/pulse', label: 'Platform Pulse', icon: Activity },
    { href: '/tenants', label: 'Tenants', icon: Building2 },
    { href: '/support', label: 'Support Queue', icon: Headphones, badge: unreadCount },
    { href: '/admins', label: 'Admins', icon: Users },
    { href: '/security', label: 'Security', icon: KeyRound },
    { href: '/infrastructure', label: 'Infrastructure', icon: Server },
    { href: '/audit', label: 'Audit Trail', icon: ShieldAlert },
  ];

  if (!clientReady) {
    return <div className="bg-background flex min-h-dvh animate-pulse" aria-hidden="true" />;
  }

  if (token && twoFALoading) {
    return <div className="bg-background flex min-h-dvh animate-pulse" aria-hidden="true" />;
  }

  if (token && !twoFALoading && twoFAIsError) {
    const status = twoFAReqError instanceof ApiError ? twoFAReqError.status : 0;
    if (status === 404) {
      return (
        <PlatformTwoFaApiMissingScreen
          onSignOut={() => {
            logout();
            router.push('/login');
          }}
        />
      );
    }
    const raw =
      twoFAReqError instanceof ApiError
        ? twoFAReqError.message
        : twoFAReqError instanceof Error
          ? twoFAReqError.message
          : 'Unexpected error';
    return (
      <PlatformTwoFaStatusErrorScreen
        message={formatPlatformApiErrorMessage(raw)}
        onRetry={() =>
          void queryClient.invalidateQueries({ queryKey: ['platform', '2fa', 'status'] })
        }
        onSignOut={() => {
          logout();
          router.push('/login');
        }}
      />
    );
  }

  if (token && twoFAStatus && !twoFAStatus.enabled) {
    return <TwoFAEnrollmentWall token={token} />;
  }

  return (
    <div className="bg-background text-foreground flex h-dvh min-h-0 overflow-hidden">
      {/* ── Skip navigation link (hidden until focused) ── */}
      <a
        href="#main-content"
        className="bg-background text-foreground border-border sr-only z-[9999] rounded-md border px-4 py-2 text-sm font-semibold shadow-md focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:ring-2 focus:ring-indigo-500/30"
      >
        Skip to main content
      </a>

      <aside
        className={cn(
          'border-border bg-card relative flex min-h-0 shrink-0 flex-col overflow-visible border-r transition-all duration-300 ease-in-out',
          sidebarCollapsed ? 'w-[76px]' : 'w-64',
        )}
        aria-label="Platform operator navigation"
      >
        {/* Floating Collapse/Expand Trigger Button */}
        <button
          type="button"
          onClick={toggleSidebar}
          aria-expanded={!sidebarCollapsed}
          aria-controls="platform-sidebar-nav"
          aria-label={
            sidebarCollapsed ? 'Expand sidebar navigation' : 'Collapse sidebar navigation'
          }
          className="border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground absolute -right-3 top-6 z-50 flex h-6 w-6 items-center justify-center rounded-full border shadow-sm transition-all duration-200"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
          ) : (
            <ChevronLeft className="h-3 w-3" aria-hidden="true" />
          )}
        </button>

        <div
          className={cn(
            'border-border flex h-16 shrink-0 items-center border-b transition-all duration-300',
            sidebarCollapsed ? 'justify-center px-0' : 'justify-between px-5',
          )}
        >
          {sidebarCollapsed ? (
            <button
              type="button"
              onClick={toggleSidebar}
              aria-expanded={!sidebarCollapsed}
              aria-controls="platform-sidebar-nav"
              aria-label="Expand sidebar navigation"
              className="flex h-9 w-9 items-center justify-center transition-all hover:scale-105 active:scale-95"
            >
              <QlessqLogoMark size={38} aria-hidden="true" />
            </button>
          ) : (
            <Link
              href="/pulse"
              className="flex min-w-0 items-center gap-2.5"
              aria-label="Patron Loyalty Admin — go to Platform Pulse"
            >
              <QlessqLogoMark size={38} className="shrink-0" aria-hidden="true" />
              <div className="flex min-w-0 flex-col gap-0.5">
                <QlessqWordmark height={20} aria-hidden="true" />
                <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
                  Loyalty Admin
                </span>
              </div>
            </Link>
          )}
        </div>

        <nav
          id="platform-sidebar-nav"
          className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-3 py-3"
          aria-label="Main navigation"
        >
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                aria-label={
                  sidebarCollapsed
                    ? item.badge && item.badge > 0
                      ? `${item.label}, ${item.badge} unread`
                      : item.label
                    : undefined
                }
                className={cn(
                  'group flex items-center rounded-xl transition-all duration-200',
                  sidebarCollapsed
                    ? 'mx-auto h-11 w-11 justify-center px-0 py-0'
                    : 'gap-3 px-3 py-2.5 text-sm font-medium',
                  active
                    ? 'bg-indigo-50 text-indigo-700 shadow-sm dark:bg-indigo-950/45 dark:text-indigo-300'
                    : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                )}
              >
                <div className="relative flex shrink-0 items-center justify-center">
                  <Icon
                    className={cn(
                      'h-[18px] w-[18px] transition-colors',
                      active
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-muted-foreground/70 group-hover:text-foreground',
                    )}
                    aria-hidden="true"
                  />
                  {sidebarCollapsed && (item.badge ?? 0) > 0 && (
                    <span
                      className="absolute -right-1.5 -top-1.5 flex h-2 w-2 animate-pulse rounded-full bg-indigo-600 shadow-[0_0_0_2px_var(--card)]"
                      aria-hidden="true"
                    />
                  )}
                </div>
                {!sidebarCollapsed && <span className="flex-1 truncate">{item.label}</span>}
                {!sidebarCollapsed && (item.badge ?? 0) > 0 && (
                  <span
                    className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[10px] font-bold text-white shadow-sm"
                    aria-label={`${item.badge} unread`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Live region: announces unread count changes to screen readers without interrupting focus */}
        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {unreadCount > 0
            ? `${unreadCount} unread support ticket${unreadCount === 1 ? '' : 's'}`
            : ''}
        </div>

        <div className="border-border shrink-0 space-y-3 border-t p-3">
          {sidebarCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div
                className="border-border bg-card text-muted-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-xs font-bold"
                aria-label={`Signed in as ${user?.email ?? 'operator'}`}
                role="img"
              >
                {user?.email?.[0].toUpperCase() || 'A'}
              </div>
              <button
                type="button"
                onClick={() => {
                  logout();
                  router.push('/login');
                }}
                aria-label="Log out of platform admin"
                className="border-border bg-card text-muted-foreground hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive flex h-10 w-10 items-center justify-center rounded-xl border transition-all"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="border-border bg-muted/30 rounded-2xl border p-3">
              <div className="flex items-center gap-3">
                <div
                  className="border-border bg-card text-muted-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-xs font-bold"
                  aria-label={`Signed in as ${user?.email ?? 'operator'}`}
                  role="img"
                >
                  {user?.email?.[0].toUpperCase() || 'A'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">Operator</p>
                  <p className="text-muted-foreground truncate text-[10px]">{user?.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  logout();
                  router.push('/login');
                }}
                aria-label="Log out of platform admin"
                className="border-border bg-card text-muted-foreground hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive mt-3 flex w-full items-center justify-center gap-2 rounded-xl border py-2 text-xs font-medium transition-all"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                Log out
              </button>
            </div>
          )}

          {sidebarCollapsed ? (
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${dashboardTheme === 'light' ? 'dark' : 'light'} mode`}
              aria-pressed={dashboardTheme === 'dark'}
              className="border-border bg-card text-muted-foreground hover:bg-muted/70 hover:text-foreground mx-auto flex h-10 w-10 items-center justify-center rounded-xl border transition-all"
            >
              {dashboardTheme === 'light' ? (
                <Moon className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Sun className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          ) : (
            <div
              className="border-border/60 bg-muted/50 flex rounded-lg border p-0.5"
              role="group"
              aria-label="Color theme"
            >
              <button
                type="button"
                onClick={() => dashboardTheme !== 'light' && toggleTheme()}
                aria-pressed={dashboardTheme === 'light'}
                aria-label="Light mode"
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-all duration-200',
                  dashboardTheme === 'light'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Sun className="h-3.5 w-3.5" aria-hidden="true" />
                Light
              </button>
              <button
                type="button"
                onClick={() => dashboardTheme !== 'dark' && toggleTheme()}
                aria-pressed={dashboardTheme === 'dark'}
                aria-label="Dark mode"
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-all duration-200',
                  dashboardTheme === 'dark'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Moon className="h-3.5 w-3.5" aria-hidden="true" />
                Dark
              </button>
            </div>
          )}
        </div>
      </aside>

      <main
        id="main-content"
        className="bg-background min-h-0 flex-1 overflow-y-auto"
        tabIndex={-1}
      >
        <div className="container mx-auto max-w-7xl px-6 py-8 md:px-8 md:py-10">{children}</div>
      </main>
    </div>
  );
}
