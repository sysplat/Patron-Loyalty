'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useEffect, useState } from 'react';
import { initAuthSessionSync } from '@/lib/auth-session-sync';
import { ImpersonationHandoffBootstrap } from '@/lib/impersonation-handoff-bootstrap';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            retry: (failureCount, error) => {
              const status = (error as { status?: number })?.status;
              if (status === 401 || status === 403) return false;
              return failureCount < 1;
            },
          },
        },
      }),
  );

  useEffect(() => {
    initAuthSessionSync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ImpersonationHandoffBootstrap />
      {children}
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
