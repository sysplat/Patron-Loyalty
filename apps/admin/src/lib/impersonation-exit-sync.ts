import { IMPERSONATION_ENDED_MESSAGE, type ImpersonationEndedMessage } from '@queueplatform/shared';
import { useAuthStore } from '@/lib/auth-store';

/** Restore platform-operator session after tenant web ends impersonation (cross-origin tab). */
export async function restoreAdminSessionAfterImpersonation(): Promise<void> {
  const state = useAuthStore.getState();
  if (state.user?.impersonation) {
    state.exitImpersonation();
  }

  if (useAuthStore.getState().accessToken && !useAuthStore.getState().user?.impersonation) {
    return;
  }

  try {
    const res = await fetch('/api/auth/session', { credentials: 'include' });
    const payload = (await res.json().catch(() => null)) as {
      authenticated?: boolean;
      data?: { accessToken?: string };
    } | null;
    const accessToken = payload?.data?.accessToken;
    if (!payload?.authenticated || !accessToken) return;

    const user = useAuthStore.getState().user;
    if (user?.impersonation) {
      useAuthStore.getState().setAuth(accessToken, {
        ...user,
        impersonation: undefined,
        roleSimulation: undefined,
        simulatedBranchId: undefined,
        simulatedBranchName: undefined,
      });
    } else {
      useAuthStore.getState().setTokensFromRefresh(accessToken);
    }
  } catch {
    /* ignore — admin middleware / next navigation may recover */
  }
}

export function isImpersonationEndedMessage(data: unknown): data is ImpersonationEndedMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as ImpersonationEndedMessage).type === IMPERSONATION_ENDED_MESSAGE
  );
}
