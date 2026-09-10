'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useState } from 'react';

export interface QueryProviderProps {
  children: React.ReactNode;
  /** Whether to show the Toaster (defaults to true). */
  showToaster?: boolean;
}

export function QueryProvider({ children, showToaster = true }: QueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            retry: (failureCount, error) => {
              const status = (error as { status?: number })?.status;
              // Don't retry on auth errors
              if (status === 401 || status === 403) return false;
              // Retry once for all other errors
              return failureCount < 1;
            },
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {showToaster && <Toaster richColors position="top-right" />}
    </QueryClientProvider>
  );
}
