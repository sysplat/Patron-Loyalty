'use client';

import { useLayoutEffect } from 'react';
import {
  impersonationHandoffToSession,
  parseImpersonationHandoffFromHash,
} from '@queueplatform/shared';
import { useAuthStore } from '@/lib/auth-store';

/** Apply platform-admin impersonation hash before loyalty dashboard auth gates run. */
export function ImpersonationHandoffBootstrap() {
  const setAuth = useAuthStore((s) => s.setAuth);

  useLayoutEffect(() => {
    const payload = parseImpersonationHandoffFromHash(window.location.hash);
    if (!payload) return;

    const session = impersonationHandoffToSession(payload);
    setAuth(session.accessToken, session.user);

    const cleanUrl = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, '', cleanUrl);
  }, [setAuth]);

  return null;
}
