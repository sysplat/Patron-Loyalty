import { useAuthStore } from '@/lib/auth-store';

/** Pull access JWT from HttpOnly cookie via BFF after refresh/login set cookies. */
export async function syncAccessTokenFromBff(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const res = await fetch('/api/auth/token', { credentials: 'include', cache: 'no-store' });
    if (!res.ok) return false;
    const payload = (await res.json().catch(() => null)) as { accessToken?: string } | null;
    if (!payload?.accessToken) return false;
    useAuthStore.getState().setTokensFromRefresh(payload.accessToken);
    return true;
  } catch {
    return false;
  }
}
