'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { QlessqWordmark } from '@/components/brand';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('This link is missing a verification token.');
      return;
    }

    api
      .post('/auth/verify-email', { token }, { skipAuth: true })
      .then(() => {
        setStatus('success');
        toast.success('Email verified successfully!');
      })
      .catch((err) => {
        setStatus('error');
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Verification failed — the link may be expired or already used.',
        );
      });
  }, [token]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-violet-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border bg-white/90 p-8 text-center shadow-xl backdrop-blur">
        <QlessqWordmark height={22} className="mx-auto" />
        <p className="text-muted-foreground mt-1 text-xs font-semibold uppercase tracking-wider">
          Patron Loyalty
        </p>

        {status === 'verifying' && (
          <div className="mt-6 space-y-4">
            <Loader2 className="text-primary mx-auto h-12 w-12 animate-spin" />
            <h1 className="text-xl font-bold">Verifying your email…</h1>
          </div>
        )}

        {status === 'success' && (
          <div className="mt-6 space-y-4">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            <h1 className="text-xl font-bold text-emerald-700">Email verified</h1>
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="bg-primary text-primary-foreground hover:bg-primary/90 h-11 w-full rounded-lg text-sm font-semibold"
            >
              Continue to sign in
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="mt-6 space-y-4">
            <XCircle className="mx-auto h-12 w-12 text-red-600" />
            <h1 className="text-xl font-bold text-red-700">Verification failed</h1>
            <p className="text-muted-foreground text-sm">{errorMessage}</p>
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="bg-primary text-primary-foreground hover:bg-primary/90 h-11 w-full rounded-lg text-sm font-semibold"
            >
              Go to sign in
            </button>
          </div>
        )}

        <p className="text-muted-foreground mt-6 text-sm">
          <Link href="/login" className="text-primary font-medium hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={<main className="flex min-h-screen items-center justify-center">Verifying…</main>}
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
