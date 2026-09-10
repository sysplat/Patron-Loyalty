import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  orgId: string;
  orgName: string;
  orgSlug: string;
  orgTimezone?: string;
  role: string;
  twoFactorEnabled?: boolean;
  platformOperator?: boolean;
  impersonation?: boolean;
  roleSimulation?: boolean;
  simulatedBranchId?: string;
  simulatedBranchName?: string;
};

export interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  setAuth: (accessToken: string, user: AuthUser, refreshToken?: string | null) => void;
  setTokensFromRefresh: (accessToken: string, refreshToken?: string) => void;
  updateUser: (patch: Partial<AuthUser>) => void;
  beginImpersonation: (
    newAccessToken: string,
    userPatch: Partial<AuthUser> & Pick<AuthUser, 'orgId' | 'orgName' | 'role'>,
  ) => void;
  exitImpersonation: () => void;
  clearSession: () => void;
  hasImpersonationBackup: () => boolean;
  logout: () => void;
}

export type AuthStoreConfig = {
  storageKey: string;
  onSyncAuthContext?: (user: AuthUser | null) => void;
};

export function createAuthStore(config: AuthStoreConfig) {
  let impersonationBackup: { accessToken: string | null; user: AuthUser | null } | null = null;

  return create<AuthState>()(
    persist(
      (set, get) => ({
        accessToken: null,
        user: null,
        setAuth: (accessToken, user) => {
          set({ accessToken, user });
          config.onSyncAuthContext?.(user);
        },
        setTokensFromRefresh: (accessToken) => {
          set({ accessToken });
        },
        updateUser: (patch) => {
          const cur = get().user;
          if (!cur) return;
          set({ user: { ...cur, ...patch } });
        },
        beginImpersonation: (newAccessToken, userPatch) => {
          const cur = get();
          if (!cur.user) return;
          if (cur.accessToken && !cur.user.impersonation) {
            impersonationBackup = { accessToken: cur.accessToken, user: cur.user };
          }
          const nextUser: AuthUser = {
            ...cur.user,
            ...userPatch,
            impersonation: true,
          };
          set({ accessToken: newAccessToken, user: nextUser });
          config.onSyncAuthContext?.(nextUser);
        },
        exitImpersonation: () => {
          if (!impersonationBackup?.user) return;
          try {
            const { accessToken, user } = impersonationBackup;
            impersonationBackup = null;
            if (!accessToken) return;
            get().setAuth(accessToken, { ...user, impersonation: undefined });
          } catch {
            impersonationBackup = null;
          }
        },
        clearSession: () => {
          if (typeof window !== 'undefined') {
            fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(
              () => undefined,
            );
            try {
              localStorage.removeItem(config.storageKey);
            } catch {
              /* ignore quota / private mode */
            }
          }
          impersonationBackup = null;
          set({ accessToken: null, user: null });
          config.onSyncAuthContext?.(null);
        },
        hasImpersonationBackup: () => Boolean(impersonationBackup?.user),
        logout: () => {
          impersonationBackup = null;
          set({ accessToken: null, user: null });
          config.onSyncAuthContext?.(null);
          if (typeof window === 'undefined') return;

          try {
            localStorage.removeItem(config.storageKey);
          } catch {
            /* ignore */
          }

          let redirected = false;
          const redirectToLogin = () => {
            if (redirected) return;
            redirected = true;
            window.location.replace('/login?reauth=1');
          };

          // Try to clear cookies first, but never let a stuck network request trap
          // the app on a loading shell.
          const fallback = window.setTimeout(redirectToLogin, 1500);
          void fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include',
            keepalive: true,
            signal: AbortSignal.timeout(1500),
          })
            .catch(() => undefined)
            .finally(() => {
              window.clearTimeout(fallback);
              // reauth=1 forces middleware to drop cookies if logout did not stick,
              // preventing Authenticating… ↔ /login bounce loops.
              window.location.replace('/login?reauth=1');
            });
        },
      }),
      {
        name: config.storageKey,
        partialize: (state) => ({ user: state.user }),
        merge: (persisted, current) => {
          const p = persisted as Partial<AuthState> | undefined;
          const c = current as AuthState;
          if (!p?.user) return c;
          if (c.accessToken && c.user) {
            return {
              ...c,
              user: { ...p.user, ...c.user },
            };
          }
          // Persist user as a warm cache only. Session restore prefers the HttpOnly
          // cookie + GET /auth/session profile so a missing localStorage profile is
          // no longer a dead end.
          return { ...c, user: p.user };
        },
      },
    ),
  );
}

type PersistApi = {
  hasHydrated: () => boolean;
  onFinishHydration: (fn: () => void) => () => void;
};

export function createAuthPersistHelpers(useStore: any) {
  function getAuthPersist(): PersistApi | undefined {
    return useStore.persist;
  }

  return {
    onAuthPersistHydrated: (callback: () => void): (() => void) => {
      if (typeof window === 'undefined') return () => {};
      const persistApi = getAuthPersist();
      if (!persistApi) {
        queueMicrotask(callback);
        return () => {};
      }
      if (persistApi.hasHydrated()) {
        queueMicrotask(callback);
        return () => {};
      }
      return persistApi.onFinishHydration(callback);
    },
    authPersistHasHydrated: (): boolean => {
      if (typeof window === 'undefined') return false;
      return getAuthPersist()?.hasHydrated() ?? false;
    },
  };
}
