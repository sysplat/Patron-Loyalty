'use client';

import { useSyncExternalStore } from 'react';

function subscribe(onStoreChange: () => void) {
  if (typeof document === 'undefined') return () => {};
  document.addEventListener('visibilitychange', onStoreChange);
  return () => document.removeEventListener('visibilitychange', onStoreChange);
}

function getTabVisibleSnapshot(): boolean {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

function getServerSnapshot(): boolean {
  return true;
}

/** True when the browser tab is visible — use to pause refetchInterval polling in background tabs. */
export function useTabVisible(): boolean {
  return useSyncExternalStore(subscribe, getTabVisibleSnapshot, getServerSnapshot);
}
