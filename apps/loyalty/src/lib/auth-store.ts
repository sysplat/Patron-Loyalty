import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { syncSentryAuthContext } from '@/lib/sentry-client';

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  orgId: string;
  orgName: string;
  orgSlug: string;
  /** Organization IANA zone (e.g. America/Vancouver); used for date pickers and reporting copy. */
  orgTimezone?: string;
  role: string;
  twoFactorEnabled: boolean;
  /** From API: QlessQ platform operator (internal org or env allowlist). */
  platformOperator?: boolean;
  /** True while using a short-lived impersonation JWT (platform operators only). */
  impersonation?: boolean;
};

let impersonationBackup: { accessToken: string | null; user: AuthUser | null } | null = null;

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  /**
   * @param refreshToken — Omit to keep the existing refresh token (e.g. user profile patch only).
   */
  setAuth: (accessToken: string, user: AuthUser, refreshToken?: string | null) => void;
  /** Update access token after `/api/auth/refresh` without touching user. */
  setTokensFromRefresh: (accessToken: string, refreshToken?: string) => void;
  /** Merge fields into the persisted user (e.g. sync organization timezone from /organization). */
  updateUser: (patch: Partial<AuthUser>) => void;
  /** Enter impersonation session; backs up current session in sessionStorage. */
  beginImpersonation: (
    newAccessToken: string,
    userPatch: Partial<AuthUser> & Pick<AuthUser, 'orgId' | 'orgName' | 'role'>,
  ) => void;
  /** Restore session before impersonation. */
  exitImpersonation: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,
      setAuth: (accessToken, user) => {
        set({ accessToken, user });
        syncSentryAuthContext(user);
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
        syncSentryAuthContext(nextUser);
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
      logout: () => {
        if (typeof window !== 'undefined') {
          fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
        }
        impersonationBackup = null;
        set({ accessToken: null, user: null });
        syncSentryAuthContext(null);
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      },
    }),
    {
      name: 'qp-auth-v2-user',
      partialize: (state) => ({ user: state.user }),
      /**
       * Fresh login keeps an in-memory session; a late persist rehydrate must not
       * overwrite newer fields (e.g. twoFactorEnabled) with stale localStorage.
       */
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
        return { ...c, ...p };
      },
    },
  ),
);
