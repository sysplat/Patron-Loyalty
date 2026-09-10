'use client';

import { useState, useRef, useEffect } from 'react';
import { flushSync } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { QlessqBrand } from '@/components/brand';
import { resolveTenantWebUrl } from '@queueplatform/shared';

type LoginUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  orgId: string;
  emailVerified?: boolean;
  role?: string;
  platformOperator?: boolean;
};

type LoginOrg = { id: string; name: string; slug: string; onboardingStep?: string };

export default function LoginPage() {
  const router = useRouter();
  const webBase = resolveTenantWebUrl(
    process.env.NEXT_PUBLIC_WEB_URL,
    typeof window !== 'undefined' ? window.location.hostname : undefined,
  );
  const setAuth = useAuthStore((s) => s.setAuth);
  const loginAttemptRef = useRef(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [twoFactorToken, setTwoFactorToken] = useState<string | null>(null);
  const [pendingUser, setPendingUser] = useState<LoginUser | null>(null);
  const [pendingOrg, setPendingOrg] = useState<LoginOrg | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState(6);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [orgsToSelect, setOrgsToSelect] = useState<
    { id: string; name: string; slug: string }[] | null
  >(null);

  function applySession(accessToken: string, refreshToken: string, user: LoginUser, org: LoginOrg) {
    setAuth(
      accessToken,
      {
        id: user.id,
        email: user.email,
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        orgId: user.orgId,
        orgName: org.name,
        orgSlug: org.slug,
        role: user.role ?? 'viewer',
        platformOperator: user.platformOperator,
      },
      refreshToken,
    );
  }

  async function handlePasswordSubmit(e?: React.FormEvent, selectedOrgId?: string) {
    e?.preventDefault();
    setError('');
    setLoading(true);
    setTwoFactorToken(null);
    setPendingUser(null);
    setPendingOrg(null);
    setOrgsToSelect(null);

    try {
      const res = await api.post<{
        success: boolean;
        data: {
          requiresOrgSelection?: true;
          organizations?: { id: string; name: string; slug: string }[];
          requiresTwoFactor?: true;
          adminDashboardTwoFactor?: true;
          twoFactorToken?: string;
          user: LoginUser;
          organization: LoginOrg;
          tokens?: { accessToken: string; refreshToken: string };
        };
      }>(
        '/api/auth/login',
        {
          email,
          password,
          platformAdmin: true,
          ...(selectedOrgId ? { orgId: selectedOrgId } : {}),
        },
        { skipAuth: true },
      );

      const d = res?.data;
      if (d?.requiresOrgSelection && d.organizations?.length) {
        setOrgsToSelect(d.organizations);
        return;
      }
      if (d?.requiresTwoFactor && d?.twoFactorToken) {
        loginAttemptRef.current += 1;
        setTwoFactorToken(d.twoFactorToken);
        setPendingUser(d.user);
        setPendingOrg(d.organization);
        setTotpCode('');
        return;
      }
      if (d.tokens) {
        applySession(d.tokens.accessToken, d.tokens.refreshToken, d.user, d.organization);
        router.push('/tenants');
      }
    } catch (err: unknown) {
      const e = err as { data?: { message?: string }; message?: string };
      setError(e.data?.message ?? e.message ?? 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  async function handleTotpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!twoFactorToken || !pendingUser || !pendingOrg) return;
    const attempt = loginAttemptRef.current;
    setLoading(true);
    try {
      const res = await api.post<{
        success: boolean;
        data: {
          user: LoginUser;
          organization: LoginOrg;
          tokens: { accessToken: string; refreshToken: string };
        };
      }>('/api/auth/login/2fa', { twoFactorToken, code: totpCode.trim() }, { skipAuth: true });

      if (attempt !== loginAttemptRef.current) return;

      applySession(
        res?.data?.tokens?.accessToken ?? '',
        res?.data?.tokens?.refreshToken ?? '',
        res?.data?.user as any,
        res?.data?.organization as any,
      );
      router.push('/tenants');
    } catch (err: unknown) {
      if (attempt !== loginAttemptRef.current) return;
      const e = err as { data?: { message?: string }; message?: string };
      const newAttempts = remainingAttempts - 1;
      setRemainingAttempts(newAttempts);
      if (newAttempts <= 0) {
        setError('Too many failed attempts. Please wait 1 minute before trying again.');
      } else {
        setError(e.data?.message ?? e.message ?? 'Invalid code');
      }
    } finally {
      if (attempt === loginAttemptRef.current) {
        setLoading(false);
      }
    }
  }

  const totpStep = Boolean(twoFactorToken && pendingUser && pendingOrg);
  const selectionStep = Boolean(orgsToSelect && !totpStep);

  if (!mounted) return null;

  return (
    <div className="relative flex min-h-screen">
      <div className="relative hidden overflow-hidden lg:flex lg:w-1/2">
        <div className="from-primary via-primary/80 absolute inset-0 bg-gradient-to-br to-violet-700" />
        <div className="absolute inset-0 overflow-hidden">
          <div className="animate-float-slow absolute -left-20 -top-20 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
          <div className="animate-float-medium absolute right-10 top-1/3 h-72 w-72 rounded-full bg-white/5 blur-2xl" />
          <div className="animate-float-fast absolute bottom-10 left-1/4 h-80 w-80 rounded-full bg-violet-400/10 blur-3xl" />
          <div
            className="animate-float-medium absolute left-1/3 top-1/4 h-40 w-40 rounded-full bg-white/5 blur-xl"
            style={{ animationDelay: '2s' }}
          />
        </div>
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <QlessqBrand href={null} markSize={54} wordmarkHeight={32} tone="onDark" />
          <div className="max-w-md space-y-6">
            <h2 className="text-4xl font-bold leading-tight">
              Platform Operations.
              <br />
              <span className="text-white/70">Secure access.</span>
            </h2>
            <p className="text-lg leading-relaxed text-white/60">Authorized personnel only.</p>
          </div>
          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} Sysplat Patron Loyalty. All rights reserved.
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/50 px-6 py-12">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:hidden">
            <QlessqBrand href={null} markSize={48} wordmarkHeight={28} className="inline-flex" />
          </div>

          <div className="rounded-2xl border bg-white/80 p-8 shadow-xl shadow-blue-100/30 backdrop-blur">
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold">
                {totpStep
                  ? 'Admin Dashboard security'
                  : selectionStep
                    ? 'Select operator organization'
                    : 'Welcome back'}
              </h1>
              <p className="text-muted-foreground mt-2 text-sm">
                {totpStep
                  ? 'Enter your Admin Dashboard 2FA code from the authenticator entry labeled “Patron Loyalty Admin”.'
                  : selectionStep
                    ? 'Your account is linked to more than one operator context. Pick one to continue.'
                    : 'Sign in to Platform Operations'}
              </p>
            </div>

            {!totpStep && !selectionStep ? (
              <form onSubmit={(ev) => void handlePasswordSubmit(ev)} className="space-y-4">
                {error && (
                  <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
                    {error}
                  </div>
                )}
                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-sm font-medium">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="border-input bg-background ring-primary/20 h-11 w-full rounded-lg border px-3 text-sm outline-none transition focus:ring-4"
                    placeholder="email@example.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="text-sm font-medium">
                      Password
                    </label>
                    <Link
                      href={`${webBase}/forgot-password`}
                      className="text-primary text-xs hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="border-input bg-background ring-primary/20 h-11 w-full rounded-lg border px-3 text-sm outline-none transition focus:ring-4"
                    placeholder="••••••••"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-primary text-primary-foreground shadow-primary/20 hover:bg-primary/90 h-11 w-full rounded-lg text-sm font-semibold shadow-lg transition disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Signing in…
                    </span>
                  ) : (
                    'Sign in'
                  )}
                </button>
              </form>
            ) : selectionStep ? (
              <div className="space-y-4">
                {error && (
                  <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  {orgsToSelect?.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      disabled={loading}
                      onClick={() => void handlePasswordSubmit(undefined, o.id)}
                      className="border-input bg-background hover:border-primary hover:bg-primary/5 flex w-full flex-col rounded-lg border px-4 py-3 text-left text-sm transition disabled:opacity-50"
                    >
                      <span className="text-foreground font-semibold">{o.name}</span>
                      <span className="text-muted-foreground font-mono text-xs">{o.slug}</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-primary w-full text-center text-xs"
                  onClick={() => {
                    setOrgsToSelect(null);
                    setError('');
                  }}
                >
                  Back to password
                </button>
              </div>
            ) : (
              <form onSubmit={handleTotpSubmit} className="space-y-4">
                {error && (
                  <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
                    {error}
                  </div>
                )}
                <div className="space-y-1.5">
                  <label htmlFor="totp" className="text-sm font-medium">
                    Admin Dashboard 2FA code
                  </label>
                  <input
                    id="totp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    required
                    className="border-input bg-background ring-primary/20 h-11 w-full rounded-lg border px-3 font-mono text-sm tracking-widest outline-none transition focus:ring-4"
                    placeholder="000000"
                    maxLength={14}
                    disabled={remainingAttempts <= 0}
                  />
                  {remainingAttempts < 6 && remainingAttempts > 0 && (
                    <p className="animate-in fade-in slide-in-from-top-1 text-xs font-medium text-amber-600">
                      {remainingAttempts} {remainingAttempts === 1 ? 'attempt' : 'attempts'}{' '}
                      remaining
                    </p>
                  )}
                  {remainingAttempts <= 0 && (
                    <p className="text-destructive animate-pulse text-xs font-medium">
                      Too many attempts. Please wait 1 minute.
                    </p>
                  )}
                  <p className="text-muted-foreground text-xs">
                    Use the 6-digit code from “Patron Loyalty Admin” in your app, or a one-time
                    backup code.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={loading || !totpCode.trim() || remainingAttempts <= 0}
                  className="bg-primary text-primary-foreground shadow-primary/20 hover:bg-primary/90 h-11 w-full rounded-lg text-sm font-semibold shadow-lg transition disabled:opacity-50"
                >
                  {loading ? 'Verifying…' : 'Continue'}
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-primary w-full text-center text-xs"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    loginAttemptRef.current += 1;
                    flushSync(() => {
                      setTwoFactorToken(null);
                      setPendingUser(null);
                      setPendingOrg(null);
                      setOrgsToSelect(null);
                      setTotpCode('');
                      setError('');
                      setLoading(false);
                      setRemainingAttempts(6);
                    });
                  }}
                >
                  Back to password
                </button>
              </form>
            )}

            <p className="text-muted-foreground mt-6 text-center text-sm">
              Access is restricted to authorized platform operators only.
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes float-slow {
          0%,
          100% {
            transform: translateY(0) translateX(0);
          }
          50% {
            transform: translateY(-30px) translateX(20px);
          }
        }
        @keyframes float-medium {
          0%,
          100% {
            transform: translateY(0) translateX(0);
          }
          50% {
            transform: translateY(20px) translateX(-15px);
          }
        }
        @keyframes float-fast {
          0%,
          100% {
            transform: translateY(0) translateX(0);
          }
          50% {
            transform: translateY(-20px) translateX(10px);
          }
        }
        .animate-float-slow {
          animation: float-slow 12s ease-in-out infinite;
        }
        .animate-float-medium {
          animation: float-medium 8s ease-in-out infinite;
        }
        .animate-float-fast {
          animation: float-fast 6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
