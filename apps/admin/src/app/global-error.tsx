'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Something went wrong</h1>
        <p className="max-w-md text-sm text-slate-600">
          An unexpected error occurred. Our team has been notified if error tracking is enabled.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
