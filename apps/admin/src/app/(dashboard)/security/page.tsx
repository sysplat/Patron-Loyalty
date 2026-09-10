'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { KeyRound, ShieldCheck, Copy, CheckCircle2, Loader2 } from 'lucide-react';

type Status = { enabled: boolean; enrollmentPending: boolean };

export default function SecurityPage() {
  const token = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [enableCode, setEnableCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [msg, setMsg] = useState('');
  const [regenPassword, setRegenPassword] = useState('');
  const [regenTotp, setRegenTotp] = useState('');
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenCodes, setRegenCodes] = useState<string[] | null>(null);
  const [regenCopied, setRegenCopied] = useState(false);
  const [regenError, setRegenError] = useState('');

  const { data: status } = useQuery({
    queryKey: ['platform', '2fa', 'status'],
    queryFn: () =>
      api
        .get<{ success: boolean; data: Status }>('/platform-admin/2fa/status', { token: token! })
        .then((r) => r?.data),
    enabled: !!token,
  });

  const setupMutation = useMutation({
    mutationFn: () =>
      api
        .post<{
          success: boolean;
          data: { secret: string; otpauthUrl: string };
        }>('/platform-admin/2fa/setup', {}, { token: token! })
        .then((r) => r?.data),
    onSuccess: (d) => {
      setSetup(d);
      setBackupCodes(null);
      setMsg('');
      queryClient.invalidateQueries({ queryKey: ['platform', '2fa', 'status'] });
    },
  });

  const enableMutation = useMutation({
    mutationFn: (code: string) =>
      api
        .post<{
          success: boolean;
          data: { backupCodes: string[] };
        }>('/platform-admin/2fa/enable', { code }, { token: token! })
        .then((r) => r?.data),
    onSuccess: (d) => {
      setBackupCodes(d.backupCodes ?? []);
      setSetup(null);
      setEnableCode('');
      setMsg('Two-factor authentication is now enabled.');
      queryClient.invalidateQueries({ queryKey: ['platform', '2fa', 'status'] });
    },
    onError: (e: Error & { data?: { message?: string } }) => {
      setMsg(e.data?.message ?? e.message ?? 'Failed to enable');
    },
  });

  const disableMutation = useMutation({
    mutationFn: (body: { password: string; code: string }) =>
      api.post('/platform-admin/2fa/disable', body, { token: token! }),
    onSuccess: () => {
      setDisablePassword('');
      setDisableCode('');
      setMsg('Two-factor authentication has been disabled.');
      queryClient.invalidateQueries({ queryKey: ['platform', '2fa', 'status'] });
    },
    onError: (e: Error & { data?: { message?: string } }) => {
      setMsg(e.data?.message ?? e.message ?? 'Failed to disable');
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: () =>
      api
        .post<{
          success: boolean;
          data: { backupCodes: string[] };
        }>(
          '/platform-admin/2fa/backup-codes/regenerate',
          { password: regenPassword, code: regenTotp.replace(/\s/g, '') },
          { token: token! },
        )
        .then((r) => r?.data),
    onSuccess: (d) => {
      setRegenCodes(d.backupCodes ?? []);
      setRegenPassword('');
      setRegenTotp('');
      setRegenError('');
      setMsg('');
      queryClient.invalidateQueries({ queryKey: ['platform', '2fa', 'status'] });
    },
    onError: (e: Error & { data?: { message?: string } }) => {
      setRegenError(e.data?.message ?? e.message ?? 'Failed to regenerate backup codes');
    },
  });

  function closeRegen() {
    setRegenOpen(false);
    setRegenCodes(null);
    setRegenPassword('');
    setRegenTotp('');
    setRegenCopied(false);
    setRegenError('');
    regenerateMutation.reset();
  }

  const enabled = status?.enabled ?? false;
  const pending = status?.enrollmentPending ?? false;

  return (
    <div className="max-w-lg">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
          <KeyRound className="h-5 w-5 text-indigo-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Security</h1>
          <p className="text-sm text-slate-500">
            Admin Dashboard two-factor (TOTP) is separate from your organization app authenticator.
            Add the entry labeled “Patron Loyalty Admin” in your authenticator app.
          </p>
        </div>
      </div>

      {msg && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
          {msg}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {backupCodes && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">Save these backup codes</p>
            <p className="mt-1 text-xs text-amber-800">
              Each code works once. Store them somewhere safe. You will not see them again.
            </p>
            <ul className="mt-2 grid gap-1 font-mono text-xs text-amber-950">
              {backupCodes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        {enabled ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-700">
              <ShieldCheck className="h-5 w-5" />
              <span className="font-medium">Two-factor authentication is on</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setRegenOpen(true);
                setRegenCodes(null);
                setMsg('');
              }}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Regenerate backup codes
            </button>
            <p className="text-sm text-slate-600">
              To disable, enter your password and a valid authenticator or backup code.
            </p>
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600">Password</label>
              <input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600">
                Authenticator or backup code
              </label>
              <input
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
                placeholder="123456"
              />
            </div>
            <button
              type="button"
              disabled={disableMutation.isPending}
              onClick={() =>
                disableMutation.mutate({ password: disablePassword, code: disableCode })
              }
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {disableMutation.isPending ? 'Disabling…' : 'Disable 2FA'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              {pending
                ? 'Finish enrollment: enter the 6-digit code from your authenticator app, then save your backup codes.'
                : 'Protect your platform operator account with a time-based one-time password (TOTP).'}
            </p>

            {!setup && !pending && (
              <button
                type="button"
                onClick={() => setupMutation.mutate()}
                disabled={setupMutation.isPending}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {setupMutation.isPending ? 'Preparing…' : 'Set up authenticator'}
              </button>
            )}

            {pending && !setup && (
              <button
                type="button"
                onClick={() => setupMutation.mutate()}
                disabled={setupMutation.isPending}
                className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
              >
                {setupMutation.isPending ? 'Loading…' : 'Continue enrollment (show QR)'}
              </button>
            )}

            {setup && (
              <>
                <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-600">
                    Scan with your authenticator app
                  </p>
                  <div className="flex justify-center rounded bg-white p-2">
                    <QRCodeSVG value={setup.otpauthUrl} size={160} />
                  </div>
                  <p className="break-all text-xs text-slate-500">
                    <span className="font-medium text-slate-700">Manual key:</span> {setup.secret}
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">6-digit code</label>
                  <input
                    value={enableCode}
                    onChange={(e) => setEnableCode(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm tracking-widest"
                    placeholder="000000"
                    maxLength={12}
                  />
                </div>
                <button
                  type="button"
                  disabled={enableMutation.isPending || !enableCode.trim()}
                  onClick={() => enableMutation.mutate(enableCode.trim())}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {enableMutation.isPending ? 'Verifying…' : 'Enable 2FA'}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {regenOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-regen-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
            <h2 id="admin-regen-title" className="text-lg font-semibold text-slate-900">
              {regenCodes ? 'New backup codes' : 'Regenerate backup codes'}
            </h2>
            {regenCodes ? (
              <div className="mt-4 space-y-4">
                <p className="text-sm text-slate-600">
                  Previous codes no longer work. Store these safely.
                </p>
                <ul className="grid max-h-40 grid-cols-2 gap-1 overflow-y-auto font-mono text-xs text-slate-800">
                  {regenCodes.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(regenCodes.join('\n'));
                      setRegenCopied(true);
                      setTimeout(() => setRegenCopied(false), 2000);
                    }}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium"
                  >
                    {regenCopied ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {regenCopied ? 'Copied' : 'Copy all'}
                  </button>
                  <button
                    type="button"
                    onClick={closeRegen}
                    className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form
                className="mt-4 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  setRegenError('');
                  regenerateMutation.mutate();
                }}
              >
                {regenError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                    {regenError}
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Password</label>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={regenPassword}
                    onChange={(e) => setRegenPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Authenticator code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={regenTotp}
                    onChange={(e) => setRegenTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center font-mono text-lg tracking-widest"
                    placeholder="000000"
                    maxLength={6}
                    required
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeRegen}
                    className="flex-1 rounded-lg border px-3 py-2 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={regenerateMutation.isPending || regenTotp.length !== 6}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {regenerateMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Working…
                      </>
                    ) : (
                      'Regenerate'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
