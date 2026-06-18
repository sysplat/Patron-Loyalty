'use client';

import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Mail } from 'lucide-react';
import { LOYALTY_PRODUCT_NAME } from '@queueplatform/shared';
import { api } from '@/lib/api';
import { QlessqBrand } from '@/components/brand';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!email.trim()) {
      toast.error('Please enter your email address.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/auth/forgot-password', { email }, { skipAuth: true });
      setSent(true);
      toast.success('If an account exists with that email, a reset link has been sent.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Something went wrong. Please try again.',
      );
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
          <h1 className="mt-2 text-2xl font-bold">Forgot your password?</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Enter the organization owner email. We&apos;ll send a reset link if an account exists.
          </p>
        </div>

        {sent ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <Mail className="h-8 w-8 text-emerald-600" />
            </div>
            <h2 className="text-lg font-semibold">Check your inbox</h2>
            <p className="text-muted-foreground text-sm">
              If an account with <strong>{email}</strong> exists, we&apos;ve sent a password reset
              link. The link expires in 1 hour.
            </p>
            <button
              type="button"
              onClick={() => {
                setSent(false);
                setEmail('');
              }}
              className="text-primary text-sm font-medium hover:underline"
            >
              Try again
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                autoFocus
                className="border-input bg-background ring-primary/20 h-11 w-full rounded-lg border px-3 text-sm outline-none transition focus:ring-4"
                placeholder="you@example.com"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="bg-primary text-primary-foreground hover:bg-primary/90 h-11 w-full rounded-lg text-sm font-semibold transition disabled:opacity-50"
            >
              {submitting ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        <p className="text-muted-foreground mt-6 text-center text-sm">
          <Link
            href="/login"
            className="text-primary inline-flex items-center gap-1 font-medium hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
