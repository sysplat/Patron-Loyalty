'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { toast } from 'sonner';
import { LOYALTY_PRODUCT_NAME } from '@queueplatform/shared';
import { api } from '@/lib/api';
import { QlessqBrand } from '@/components/brand';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const isInvite = searchParams.get('invite') === '1';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!token) {
      toast.error('This link is missing a reset token.');
      return;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
    if (password.length < 8 || !passwordRegex.test(password)) {
      toast.error(
        'Password must be at least 8 characters and contain uppercase, lowercase, and a digit.',
      );
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/auth/reset-password', { token, password }, { skipAuth: true });
      toast.success(
        isInvite
          ? 'Workspace access is ready. Please sign in.'
          : 'Password updated. Please sign in.',
      );
      router.push('/login');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to set password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border bg-white/90 p-8 shadow-xl backdrop-blur">
        <div className="mb-6 text-center">
          <QlessqBrand href="/" markSize={48} wordmarkHeight={26} className="mx-auto" />
          <p className="text-muted-foreground mt-2 text-xs font-medium uppercase tracking-wide">
            {LOYALTY_PRODUCT_NAME}
          </p>
          <h1 className="mt-2 text-2xl font-bold">
            {isInvite ? 'Set up your workspace access' : 'Reset your password'}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {isInvite
              ? 'Create your password to accept the invitation.'
              : 'Create a new password for your account.'}
          </p>
        </div>

        {!token ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            This link is invalid or missing a token. Request a new reset from the sign-in page.
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">New password</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                className="border-input bg-background ring-primary/20 h-11 w-full rounded-lg border px-3 text-sm outline-none transition focus:ring-4"
                placeholder="At least 8 characters"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Confirm password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                className="border-input bg-background ring-primary/20 h-11 w-full rounded-lg border px-3 text-sm outline-none transition focus:ring-4"
                placeholder="Repeat your password"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="bg-primary text-primary-foreground hover:bg-primary/90 h-11 w-full rounded-lg text-sm font-semibold transition disabled:opacity-50"
            >
              {submitting ? 'Saving…' : isInvite ? 'Accept invite' : 'Reset password'}
            </button>
          </form>
        )}

        <p className="text-muted-foreground mt-6 text-center text-sm">
          <Link href="/login" className="text-primary font-medium hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center px-4 py-12">
          <p className="text-muted-foreground text-sm">Loading secure link…</p>
        </main>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
