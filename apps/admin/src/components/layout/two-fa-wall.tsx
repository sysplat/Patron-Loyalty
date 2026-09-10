'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { ShieldAlert, ShieldCheck, Copy, CheckCircle2, KeyRound, LogOut } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

type TwoFAStatus = { enabled: boolean; enrollmentPending: boolean };

/** Turn opaque browser/network errors into actionable operator guidance. */
export function formatPlatformApiErrorMessage(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower === 'failed to fetch' ||
    lower.includes('networkerror') ||
    lower.includes('load failed')
  ) {
    return (
      'Cannot reach the Patron Loyalty API. From the repo root, run pnpm start (API + admin + web), ' +
      'or ensure API_URL in .env points to a server that is up. After changing env, restart the admin dev server.'
    );
  }
  return message;
}

export function PlatformTwoFaApiMissingScreen({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-8 shadow-sm">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100">
          <ShieldAlert className="h-6 w-6 text-amber-700" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Admin API is missing 2FA routes</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          This browser is calling{' '}
          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
            GET /api/v1/platform-admin/2fa/status
          </span>
          , but the API that is currently deployed does not register that endpoint (HTTP 404). Until
          the API is updated, platform 2FA cannot be enforced from this UI.
        </p>
        <p className="mt-3 text-sm text-slate-600">
          Redeploy the <span className="font-semibold">qms-api</span> service from the latest commit
          so it includes <span className="font-mono text-xs">PlatformAdminTwoFactorController</span>
          , then refresh this page.
        </p>
        <button
          type="button"
          onClick={onSignOut}
          className="mt-6 w-full rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

export function PlatformTwoFaStatusErrorScreen({
  message,
  onRetry,
  onSignOut,
}: {
  message: string;
  onRetry: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Could not load two-factor status</p>
        <p className="mt-2 text-xs text-slate-500">{message}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onRetry}
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

export function TwoFAEnrollmentWall({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [backupCopied, setBackupCopied] = useState(false);
  const [msg, setMsg] = useState('');
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();

  const { data: status } = useQuery({
    queryKey: ['platform', '2fa', 'status'],
    queryFn: () =>
      api
        .get<{ success: boolean; data: TwoFAStatus }>('/platform-admin/2fa/status', { token })
        .then((r) => r.data),
  });

  const setupMutation = useMutation({
    mutationFn: () =>
      api
        .post<{
          success: boolean;
          data: { secret: string; otpauthUrl: string };
        }>('/platform-admin/2fa/setup', {}, { token })
        .then((r) => r.data),
    onSuccess: (d) => {
      setSetup(d);
      setMsg('');
    },
  });

  const enableMutation = useMutation({
    mutationFn: (totp: string) =>
      api
        .post<{
          success: boolean;
          data: { backupCodes: string[] };
        }>('/platform-admin/2fa/enable', { code: totp }, { token })
        .then((r) => r.data),
    onSuccess: (d) => {
      setBackupCodes(d.backupCodes ?? []);
      setBackupCopied(false);
      setSetup(null);
      setCode('');
      setMsg('');
    },
    onError: (e: any) => {
      setMsg(e.data?.message ?? e.message ?? 'Invalid code. Please try again.');
    },
  });

  const step = backupCodes
    ? 'backup'
    : setup
      ? 'verify'
      : status?.enrollmentPending
        ? 'pending'
        : 'intro';

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg">
            <KeyRound className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard 2FA</h1>
          <p className="mt-2 text-sm text-slate-500">
            Platform operator access requires a{' '}
            <span className="font-medium text-slate-700">separate</span> authenticator entry labeled
            “Patron Loyalty Admin” (not your organization app code). This takes less than a minute.
          </p>
        </div>

        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          {step === 'backup' && (
            <>
              <div className="flex items-center gap-2 text-emerald-700">
                <ShieldCheck className="h-5 w-5" />
                <span className="font-semibold">Two-factor authentication enabled!</span>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">Save your backup codes</p>
                <p className="mt-1 text-xs text-amber-800">
                  Each code works once. Store them in a secure location — you will not see them
                  again.
                </p>
                <ul className="mt-3 grid grid-cols-2 gap-1 font-mono text-xs text-amber-950">
                  {backupCodes!.map((c) => (
                    <li key={c} className="rounded bg-amber-100 px-2 py-1">
                      {c}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(backupCodes!.join('\n'));
                    setBackupCopied(true);
                    window.setTimeout(() => setBackupCopied(false), 2000);
                  }}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-medium text-amber-950 transition-colors hover:bg-amber-100/80"
                >
                  {backupCopied ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {backupCopied ? 'Copied' : 'Copy all codes'}
                </button>
              </div>
              <button
                type="button"
                onClick={() =>
                  void queryClient.invalidateQueries({ queryKey: ['platform', '2fa', 'status'] })
                }
                className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
              >
                I&apos;ve saved my codes — Continue to dashboard →
              </button>
            </>
          )}

          {step === 'verify' && setup && (
            <>
              <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-600">
                  1. Scan this QR code with your authenticator app
                </p>
                <div className="flex justify-center rounded-lg bg-white p-3 shadow-sm">
                  <QRCodeSVG value={setup.otpauthUrl} size={176} />
                </div>
                <p className="break-all text-[11px] text-slate-400">
                  <span className="font-medium text-slate-600">Manual key:</span> {setup.secret}
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-600">
                  2. Enter the 6-digit code to confirm
                </label>
                <input
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setMsg('');
                  }}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-center font-mono text-lg tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                  onKeyDown={(e) =>
                    e.key === 'Enter' &&
                    code.trim().length === 6 &&
                    enableMutation.mutate(code.trim())
                  }
                />
                {msg && <p className="text-xs text-red-600">{msg}</p>}
              </div>
              <button
                disabled={enableMutation.isPending || code.trim().length < 6}
                onClick={() => enableMutation.mutate(code.trim())}
                className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
              >
                {enableMutation.isPending ? 'Verifying…' : 'Activate 2FA'}
              </button>
            </>
          )}

          {step === 'pending' && (
            <>
              <p className="text-sm text-slate-600">
                You have a pending 2FA enrollment. Click below to see your QR code and finish setup.
              </p>
              <button
                onClick={() => setupMutation.mutate()}
                disabled={setupMutation.isPending}
                className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
              >
                {setupMutation.isPending ? 'Loading QR…' : 'Continue enrollment →'}
              </button>
            </>
          )}

          {step === 'intro' && (
            <>
              <p className="text-sm text-slate-600">
                Use any TOTP authenticator app — Google Authenticator, Authy, 1Password, or similar.
              </p>
              <button
                onClick={() => setupMutation.mutate()}
                disabled={setupMutation.isPending}
                className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
              >
                {setupMutation.isPending ? 'Preparing…' : 'Set up authenticator →'}
              </button>
            </>
          )}
        </div>

        <button
          onClick={() => {
            logout();
            router.push('/login');
          }}
          className="mt-4 flex w-full items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-slate-600"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </div>
  );
}
