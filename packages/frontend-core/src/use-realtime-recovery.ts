'use client';

import { useEffect } from 'react';

export type RealtimeConnection = {
  state: string;
  connect: () => void;
  on: (event: 'connected', handler: () => void) => void;
  off: (event: 'connected', handler: () => void) => void;
};

/**
 * Enterprise-grade state recovery hook for mobile and backgrounded web views.
 *
 * When a device wakes from sleep or recovers from a network drop:
 * 1. Forces the WebSocket connection to reconnect when disconnected.
 * 2. Refreshes React Query (or any caller-provided sync callback).
 */
export function useRealtimeRecovery(
  refetchFn: () => void,
  getCentrifuge: () => RealtimeConnection,
) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleWakeUp = () => {
      if (document.visibilityState === 'visible') {
        refetchFn();

        try {
          const centrifuge = getCentrifuge();
          if (centrifuge.state === 'disconnected') {
            centrifuge.connect();
          }
        } catch {
          // Centrifuge may not be initialized yet
        }
      }
    };

    document.addEventListener('visibilitychange', handleWakeUp);
    window.addEventListener('focus', handleWakeUp);
    window.addEventListener('online', handleWakeUp);

    const centrifuge = getCentrifuge();
    const onConnect = () => {
      refetchFn();
    };
    centrifuge.on('connected', onConnect);

    return () => {
      document.removeEventListener('visibilitychange', handleWakeUp);
      window.removeEventListener('focus', handleWakeUp);
      window.removeEventListener('online', handleWakeUp);
      centrifuge.off('connected', onConnect);
    };
  }, [refetchFn, getCentrifuge]);
}
