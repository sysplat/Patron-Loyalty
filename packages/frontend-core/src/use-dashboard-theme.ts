'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  applyDashboardThemeToDocument,
  DASHBOARD_THEME_MEDIA_QUERY,
  hasStoredDashboardTheme,
  persistDashboardTheme,
  resolveDashboardTheme,
  type DashboardTheme,
} from './dashboard-theme';

export function useDashboardTheme() {
  const [theme, setThemeState] = useState<DashboardTheme>('light');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setThemeState(resolveDashboardTheme());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hasStoredDashboardTheme()) return;
    const media = window.matchMedia(DASHBOARD_THEME_MEDIA_QUERY);
    const syncTheme = (event: MediaQueryListEvent) => {
      setThemeState(event.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', syncTheme);
    return () => media.removeEventListener('change', syncTheme);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    return applyDashboardThemeToDocument(theme);
  }, [theme, hydrated]);

  const setTheme = useCallback((mode: DashboardTheme) => {
    persistDashboardTheme(mode);
    setThemeState(mode);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: DashboardTheme = prev === 'light' ? 'dark' : 'light';
      persistDashboardTheme(next);
      return next;
    });
  }, []);

  return { theme, setTheme, toggleTheme, hydrated };
}
