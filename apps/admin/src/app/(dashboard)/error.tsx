'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function DashboardError({
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
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <h2 className="text-xl font-semibold text-slate-900">Unable to load this screen</h2>
      <p className="max-w-lg text-sm text-slate-500">
        {error.message || 'An unexpected error occurred while loading dashboard data.'}
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
      >
        Retry
      </button>
    </div>
  );
}
