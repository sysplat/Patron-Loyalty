'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  BarChart3,
  CheckSquare,
  ChevronRight,
  ExternalLink,
  Gift,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Moon,
  Phone,
  Plug,
  Settings2,
  Sun,
  Tag,
  Ticket,
  Trophy,
  Users,
  Wallet,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import {
  QlessqLogoMark,
  QlessqWordmark,
  useDashboardTheme,
  type DashboardTheme,
} from '@queueplatform/frontend-core';
import { cn } from '@/lib/utils';
import { formatRoleLabel, formatUserDisplayName } from '@/lib/rbac-ui';

export const LOYALTY_NAV = [
  { href: '/overview', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/lookup', label: 'Lookup', icon: Phone },
  { href: '/patrons', label: 'Patrons', icon: Users },
  { href: '/rewards', label: 'Rewards', icon: Gift },
  { href: '/coupons', label: 'Coupons', icon: Tag },
  { href: '/wallet', label: 'Wallet', icon: Wallet },
  { href: '/referrals', label: 'Referrals', icon: Ticket },
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/engagement', label: 'Engagement', icon: Trophy },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/program', label: 'Program', icon: Settings2 },
  { href: '/integrations', label: 'Integrations', icon: Plug },
] as const;

function webAppUrl(): string {
  return (process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

function navItemActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

function currentNavLabel(pathname: string): string {
  const match = LOYALTY_NAV.find((item) => navItemActive(pathname, item.href));
  return match?.label ?? 'Loyalty';
}

function LoyaltyUserAvatar({
  firstName,
  lastName,
  email,
  logoUrl,
}: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  logoUrl?: string | null;
}) {
  const first = firstName?.trim();
  const last = lastName?.trim();
  let initials = `${(first || '')[0] || ''}${(last || '')[0] || ''}`.toUpperCase();
  if (!initials && email) {
    initials = email.slice(0, 2).toUpperCase();
  }
  if (!initials) initials = '?';
  return (
    <div className="bg-primary/10 text-primary border-border/50 relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border text-xs font-bold">
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt="Organization logo"
          width={32}
          height={32}
          className="h-full w-full object-cover"
          unoptimized
        />
      ) : (
        initials
      )}
    </div>
  );
}

function ThemeSelector({ theme, onToggle }: { theme: DashboardTheme; onToggle: () => void }) {
  return (
    <div className="bg-muted/75 border-border/40 flex rounded-lg border p-0.5">
      <button
        type="button"
        onClick={() => theme !== 'light' && onToggle()}
        className={cn(
          'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-all duration-200',
          theme === 'light'
            ? 'bg-card text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Sun className="h-3.5 w-3.5" aria-hidden />
        Light
      </button>
      <button
        type="button"
        onClick={() => theme !== 'dark' && onToggle()}
        className={cn(
          'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-all duration-200',
          theme === 'dark'
            ? 'bg-card text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Moon className="h-3.5 w-3.5" aria-hidden />
        Dark
      </button>
    </div>
  );
}

function LoyaltySidebar({
  pathname,
  organization,
  user,
  mobileOpen,
  onCloseMobile,
  onLogout,
  theme,
  onToggleTheme,
  hasQueueProduct,
  collapsed,
  onToggleCollapse,
}: {
  pathname: string;
  organization?: { name?: string; logoUrl?: string | null } | null;
  user: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    role?: string | null;
  } | null;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onLogout: () => void;
  theme: DashboardTheme;
  onToggleTheme: () => void;
  hasQueueProduct: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const displayName = formatUserDisplayName(user);
  const roleLabel = formatRoleLabel(user?.role);
  const isViewer = String(user?.role ?? '').toLowerCase() === 'viewer';
  const webUrl = webAppUrl();

  return (
    <aside
      className={cn(
        'bg-card/65 fixed inset-y-0 left-0 z-40 flex flex-col border-r shadow-xl backdrop-blur-md transition-all duration-300 ease-out dark:border-slate-800/50 dark:bg-slate-950/70 dark:shadow-black/40',
        collapsed ? 'w-16' : 'w-64',
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      )}
    >
      {/* Mobile close button */}
      <div className="absolute right-3 top-4 z-10 md:hidden">
        <button
          type="button"
          onClick={onCloseMobile}
          className="text-muted-foreground hover:bg-muted rounded-md p-1"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Desktop collapse toggle — sits on the right edge */}
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={cn(
          'text-muted-foreground hover:bg-muted bg-background absolute -right-3.5 top-[72px] z-50 hidden h-7 w-7 items-center justify-center rounded-full border shadow-sm transition-colors md:flex',
        )}
      >
        {collapsed ? (
          <PanelLeftOpen className="h-3.5 w-3.5" />
        ) : (
          <PanelLeftClose className="h-3.5 w-3.5" />
        )}
      </button>

      <div
        className={cn(
          'flex h-16 items-center gap-2 border-b px-5',
          collapsed ? 'pr-5' : 'pr-12 md:pr-5',
        )}
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg">
          {organization?.logoUrl ? (
            <Image
              src={organization.logoUrl}
              alt="Organization logo"
              width={44}
              height={44}
              className="h-full w-full object-cover"
              unoptimized
            />
          ) : (
            <QlessqLogoMark size={44} />
          )}
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <Link href="/" className="block min-w-0" onClick={onCloseMobile}>
              <QlessqWordmark height={24} />
            </Link>
            <p className="text-muted-foreground truncate text-[10px] font-semibold uppercase tracking-wider">
              Loyalty
            </p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3" aria-label="Loyalty">
        {LOYALTY_NAV.map(({ href, label, icon: Icon }) => {
          const active = navItemActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onCloseMobile}
              title={collapsed ? label : undefined}
              className={cn(
                'group flex items-center gap-3 rounded-lg border-l-[3px] py-2.5 pl-[9px] pr-3 text-sm font-medium transition-all duration-150',
                collapsed && 'justify-center px-0 pl-0',
                active
                  ? 'bg-primary/10 text-primary border-primary shadow-sm'
                  : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground border-transparent',
              )}
            >
              <Icon
                className={cn(
                  'h-[18px] w-[18px] shrink-0 transition-transform duration-200 group-hover:scale-110',
                  active ? 'text-primary' : 'text-muted-foreground/70 group-hover:text-foreground',
                )}
              />
              {!collapsed && <span className="truncate">{label}</span>}
              {!collapsed && active && (
                <ChevronRight className="text-primary/50 ml-auto h-4 w-4 shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 border-t p-3">
        {!collapsed && hasQueueProduct ? (
          <a
            href={`${webUrl}/dashboard`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:bg-muted/70 hover:text-foreground flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs font-medium transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">Back to Queue Management</span>
          </a>
        ) : null}

        <div
          className={cn(
            'flex items-center gap-3 rounded-lg px-2 py-2',
            collapsed && 'flex-col px-0',
          )}
        >
          <LoyaltyUserAvatar
            firstName={user?.firstName}
            lastName={user?.lastName}
            email={user?.email}
            logoUrl={organization?.logoUrl}
          />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{displayName}</p>
              <p className="text-muted-foreground truncate text-xs">{user?.email}</p>
              <p className="text-muted-foreground/80 truncate text-[10px]">
                {roleLabel}
                {isViewer ? ' · Read-only' : ''}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={onLogout}
            title="Sign out"
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-md p-1.5 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        {!collapsed && <ThemeSelector theme={theme} onToggle={onToggleTheme} />}
      </div>
    </aside>
  );
}

export function LoyaltyBootShell({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="bg-muted/40 flex min-h-screen flex-col items-center justify-center gap-4 px-6 dark:bg-gradient-to-br dark:from-slate-950 dark:via-[#0c1528] dark:to-[#070b14]">
      <QlessqLogoMark size={48} priority />
      <div className="text-muted-foreground flex items-center gap-3 text-sm">
        <div
          className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
        <span>{message}</span>
      </div>
    </div>
  );
}

export function LoyaltyDashboardShell({
  children,
  organization,
  user,
  onLogout,
  hasQueueProduct = false,
}: {
  children: React.ReactNode;
  organization?: { name?: string; logoUrl?: string | null } | null;
  user: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    role?: string | null;
  } | null;
  onLogout: () => void;
  hasQueueProduct?: boolean;
}) {
  const pathname = usePathname() ?? '/';
  const { theme, toggleTheme, hydrated } = useDashboardTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const headerLabel = currentNavLabel(pathname);

  return (
    <div className={cn(hydrated && theme === 'dark' && 'dark', 'min-h-screen overflow-x-hidden')}>
      <div className="bg-muted/30 flex min-h-screen min-w-0 dark:bg-gradient-to-br dark:from-slate-950 dark:via-[#0c1528] dark:to-[#070b14]">
        {mobileOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden dark:bg-black/70"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
        )}

        <LoyaltySidebar
          pathname={pathname}
          organization={organization}
          user={user}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
          onLogout={onLogout}
          theme={theme}
          onToggleTheme={toggleTheme}
          hasQueueProduct={hasQueueProduct}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        />

        <div
          className={cn(
            'flex min-w-0 flex-1 flex-col transition-all duration-300',
            sidebarCollapsed ? 'md:ml-16' : 'md:ml-64',
          )}
        >
          <header className="bg-card/80 sticky top-0 z-20 flex h-14 min-h-14 items-center justify-between gap-2 border-b px-3 backdrop-blur-md sm:h-16 sm:min-h-16 sm:px-4 md:px-6 dark:border-slate-700/35 dark:bg-[#0a1220]/85">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <button
                type="button"
                className="text-muted-foreground hover:bg-muted rounded-md p-1.5 md:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <h2 className="truncate text-sm font-semibold sm:text-base">{headerLabel}</h2>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
              <div className="hidden min-w-0 sm:block sm:text-right">
                <p className="text-foreground truncate text-sm">{formatUserDisplayName(user)}</p>
                <p className="text-muted-foreground truncate text-[10px]">
                  {formatRoleLabel(user?.role)}
                </p>
              </div>
              <span title={formatUserDisplayName(user)}>
                <LoyaltyUserAvatar
                  firstName={user?.firstName}
                  lastName={user?.lastName}
                  email={user?.email}
                  logoUrl={organization?.logoUrl}
                />
              </span>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
