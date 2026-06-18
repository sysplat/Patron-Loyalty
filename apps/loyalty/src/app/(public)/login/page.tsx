'use client';

import { useState, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { validateLogin } from '@/lib/validation';
import { useAuthStore } from '@/lib/auth-store';
import { QlessqBrand } from '@/components/brand';
import { AuthMarketingPanel } from '@/components/marketing/auth-marketing-panel';

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  /** Bumped when entering 2FA or abandoning it — ignores stale /auth/login/2fa responses after “Back to password”. */
  const loginAttemptRef = useRef(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [twoFactorToken, setTwoFactorToken] = useState<string | null>(null);
  const [pendingUser, setPendingUser] = useState<any>(null);
  const [pendingOrg, setPendingOrg] = useState<any>(null);
  const [orgsToSelect, setOrgsToSelect] = useState<
    { id: string; name: string; slug: string }[] | null
  >(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const totpAutoRef = useRef<string | null>(null);

  async function handleSubmit(e?: React.FormEvent, selectedOrgId?: string) {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);

    const validation = validateLogin({
      email,
      password,
      orgId: selectedOrgId,
    });
    if (!validation.ok) {
      setError(validation.error);
      setLoading(false);
      return;
    }

    try {
      const res = await api.post<{
        success: boolean;
        data: {
          requiresOrgSelection?: true;
          organizations?: { id: string; name: string; slug: string }[];
          requiresTwoFactor?: true;
          twoFactorToken?: string;
          user: {
            id: string;
            email: string;
            firstName: string | null;
            lastName: string | null;
            orgId: string;
            twoFactorEnabled: boolean;
            platformOperator?: boolean;
          };
          organization: {
            id: string;
            name: string;
            slug: string;
            onboardingStep: string;
            timezone?: string;
          };
          tokens?: { accessToken: string; refreshToken: string };
        };
      }>('/api/auth/login', { email, password, orgId: selectedOrgId }, { skipAuth: true });

      if (res?.data?.requiresOrgSelection && res?.data?.organizations) {
        setOrgsToSelect(res?.data?.organizations);
        return;
      }

      if (res?.data?.requiresTwoFactor && res?.data?.twoFactorToken) {
        loginAttemptRef.current += 1;
        setTwoFactorToken(res?.data?.twoFactorToken);
        setPendingUser(res?.data?.user);
        setPendingOrg(res?.data?.organization);
        setTotpCode('');
        setOrgsToSelect(null);
        return;
      }

      if (res?.data?.tokens) {
        setAuth(
          res?.data?.tokens?.accessToken,
          {
            id: res?.data?.user?.id,
            email: res?.data?.user?.email,
            firstName: res?.data?.user?.firstName ?? '',
            lastName: res?.data?.user?.lastName ?? '',
            orgId: res?.data?.user?.orgId,
            orgName: res?.data?.organization?.name,
            orgSlug: res?.data?.organization?.slug,
            orgTimezone: res?.data?.organization?.timezone,
            role: (res?.data?.user as any)?.role ?? 'viewer',
            twoFactorEnabled: res?.data?.user?.twoFactorEnabled,
            platformOperator: res?.data?.user?.platformOperator ?? false,
          },
          res?.data?.tokens?.refreshToken,
        );
        router.push('/overview');
      }
    } catch (err: any) {
      setError(err.data?.message ?? err.message ?? 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  const selectOrg = async (orgId: string) => {
    await handleSubmit(undefined, orgId);
  };

  const [remainingAttempts, setRemainingAttempts] = useState(6);

  const totpStep = Boolean(twoFactorToken && pendingUser && pendingOrg);
  const selectionStep = Boolean(orgsToSelect && !totpStep);

  const completeTotpLogin = useCallback(
    async (code: string) => {
      setError('');
      if (!twoFactorToken || !pendingUser || !pendingOrg) return;
      const attempt = loginAttemptRef.current;
      setLoading(true);
      try {
        const res = await api.post<{
          success: boolean;
          data: {
            user: any;
            organization: any;
            tokens: { accessToken: string; refreshToken: string };
          };
        }>('/api/auth/login/2fa', { twoFactorToken, code: code.trim() }, { skipAuth: true });

        if (attempt !== loginAttemptRef.current) return;

        setAuth(
          res?.data?.tokens?.accessToken,
          {
            id: res?.data?.user?.id,
            email: res?.data?.user?.email,
            firstName: res?.data?.user?.firstName ?? '',
            lastName: res?.data?.user?.lastName ?? '',
            orgId: res?.data?.user?.orgId,
            orgName: res?.data?.organization?.name,
            orgSlug: res?.data?.organization?.slug,
            orgTimezone: res?.data?.organization?.timezone,
            role: (res?.data?.user as any)?.role ?? 'viewer',
            twoFactorEnabled: res?.data?.user?.twoFactorEnabled,
            platformOperator:
              (res?.data?.user as { platformOperator?: boolean })?.platformOperator ?? false,
          },
          res?.data?.tokens?.refreshToken,
        );
        router.push('/overview');
      } catch (err: any) {
        if (attempt !== loginAttemptRef.current) return;

        // Decrement attempts on failure
        setRemainingAttempts((prev) => Math.max(0, prev - 1));

        const msg = err.data?.message ?? err.message ?? 'Invalid code';
        setError(
          /expired two-factor session/i.test(String(msg))
            ? 'This sign-in step expired. Go back and sign in with your password again.'
            : msg,
        );
        totpAutoRef.current = null;
      } finally {
        if (attempt === loginAttemptRef.current) {
          setLoading(false);
        }
      }
    },
    [twoFactorToken, pendingUser, pendingOrg, router, setAuth],
  );

  async function handleTotpSubmit(e: React.FormEvent) {
    e.preventDefault();
    totpAutoRef.current = null;
    await completeTotpLogin(totpCode);
  }

  function onTotpChange(raw: string) {
    const normalized = raw.replace(/\s/g, '');
    setTotpCode(normalized);
    setError('');
    if (!normalized || loading) return;
    if (/^\d{6}$/.test(normalized)) {
      if (totpAutoRef.current === normalized) return;
      totpAutoRef.current = normalized;
      void completeTotpLogin(normalized);
      return;
    }
    if (/^[A-F0-9]{10}$/i.test(normalized)) {
      const upper = normalized.toUpperCase();
      if (totpAutoRef.current === upper) return;
      totpAutoRef.current = upper;
      void completeTotpLogin(upper);
    }
  }
  return (
    <div className="relative flex min-h-screen">
      <AuthMarketingPanel />

      {/* Right panel — login form */}
      <div className="flex flex-1 flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 px-6 py-12">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="text-center lg:hidden">
            <QlessqBrand href="/" markSize={48} wordmarkHeight={28} />
          </div>

          <div className="rounded-2xl border bg-white/80 p-8 shadow-xl shadow-blue-100/30 backdrop-blur">
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold">
                {totpStep
                  ? 'Two-factor authentication'
                  : selectionStep
                    ? 'Select Organization'
                    : 'Welcome back'}
              </h1>
              <p className="text-muted-foreground mt-2 text-sm">
                {totpStep
                  ? 'Enter the code from your authenticator app.'
                  : selectionStep
                    ? 'We found multiple organizations for this email. Please choose one to continue.'
                    : 'Sign in to your Patron Loyalty workspace'}
              </p>
            </div>

            {!totpStep ? (
              selectionStep ? (
                <div className="space-y-3">
                  {error && (
                    <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
                      {error}
                    </div>
                  )}
                  <div className="grid gap-2">
                    {orgsToSelect?.map((org) => (
                      <button
                        key={org.id}
                        type="button"
                        onClick={() => selectOrg(org.id)}
                        disabled={loading}
                        className="bg-background hover:border-primary hover:bg-primary/5 group flex h-14 w-full items-center justify-between rounded-xl border px-4 py-2 text-left transition disabled:opacity-50"
                      >
                        <div className="flex flex-col">
                          <span className="group-hover:text-primary text-sm font-semibold transition">
                            {org.name}
                          </span>
                          <span className="text-muted-foreground text-xs uppercase tracking-wider">
                            {org.slug}
                          </span>
                        </div>
                        <div className="group-hover:bg-primary flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 transition group-hover:text-white">
                          <span className="text-lg">→</span>
                        </div>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setOrgsToSelect(null)}
                    className="text-muted-foreground hover:text-primary mt-4 w-full text-center text-xs"
                  >
                    Back to login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
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
                        href="/forgot-password"
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
              )
            ) : (
              <form onSubmit={handleTotpSubmit} className="space-y-4">
                {error && (
                  <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
                    {error}
                  </div>
                )}
                <div className="space-y-1.5">
                  <label htmlFor="totp" className="text-sm font-medium">
                    Authenticator or backup code
                  </label>
                  <input
                    id="totp"
                    type="text"
                    inputMode="text"
                    autoComplete="one-time-code"
                    value={totpCode}
                    onChange={(e) => onTotpChange(e.target.value)}
                    required
                    className="border-input bg-background ring-primary/20 h-11 w-full rounded-lg border px-3 font-mono text-sm tracking-widest outline-none transition focus:ring-4"
                    placeholder="000000"
                    maxLength={14}
                    autoFocus
                  />
                  <p className="text-muted-foreground text-xs">
                    6-digit app codes submit automatically. Backup codes are one-time use.
                  </p>
                  {remainingAttempts < 6 && (
                    <p
                      className={`text-xs font-medium ${remainingAttempts <= 2 ? 'text-destructive' : 'text-orange-600'}`}
                    >
                      {remainingAttempts > 0
                        ? `${remainingAttempts} attempts remaining`
                        : 'Too many failed attempts. Please wait 1 minute.'}
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={loading || !totpCode.trim() || remainingAttempts === 0}
                  className="bg-primary text-primary-foreground shadow-primary/20 hover:bg-primary/90 h-11 w-full rounded-lg text-sm font-semibold shadow-lg transition disabled:opacity-50"
                >
                  {loading ? 'Verifying…' : remainingAttempts === 0 ? 'Locked' : 'Continue'}
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-primary w-full text-center text-xs"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    loginAttemptRef.current += 1;
                    totpAutoRef.current = null;
                    flushSync(() => {
                      setTwoFactorToken(null);
                      setPendingUser(null);
                      setPendingOrg(null);
                      setOrgsToSelect(null);
                      setTotpCode('');
                      setError('');
                      setLoading(false);
                    });
                  }}
                >
                  Back to password
                </button>
                <p className="text-muted-foreground border-t pt-4 text-center text-xs leading-relaxed">
                  <span className="block">
                    Lost your authenticator or backup codes? If you are the{' '}
                    <strong className="text-foreground">organization owner</strong>, use password
                    reset — it clears two-factor so you can sign in again.
                  </span>
                  <Link
                    href="/forgot-password"
                    className="text-primary mt-2 inline-block font-medium hover:underline"
                    onClick={() => {
                      loginAttemptRef.current += 1;
                      totpAutoRef.current = null;
                      flushSync(() => {
                        setTwoFactorToken(null);
                        setPendingUser(null);
                        setPendingOrg(null);
                        setOrgsToSelect(null);
                        setTotpCode('');
                        setError('');
                        setLoading(false);
                      });
                    }}
                  >
                    Forgot password / reset access
                  </Link>
                </p>
              </form>
            )}

            {!totpStep && (
              <p className="text-muted-foreground mt-6 text-center text-sm">
                Don&apos;t have an account?{' '}
                <Link href="/signup" className="text-primary font-medium hover:underline">
                  Sign up
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Animations */}
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
