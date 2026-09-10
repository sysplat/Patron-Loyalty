import { syncSentryAuthContext } from '@/lib/sentry-client';
import { createAuthStore, createAuthPersistHelpers } from '@queueplatform/frontend-core';
export type { AuthUser, AuthState } from '@queueplatform/frontend-core';

export const useAuthStore = createAuthStore({
  storageKey: 'qp-admin-auth-v2-user',
  onSyncAuthContext: syncSentryAuthContext,
});

export const { authPersistHasHydrated, onAuthPersistHydrated } =
  createAuthPersistHelpers(useAuthStore);
