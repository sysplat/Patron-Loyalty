export const DASHBOARD_THEME_STORAGE_KEY = 'queueplatform.dashboard.theme.v1';
export const DASHBOARD_THEME_MEDIA_QUERY = '(prefers-color-scheme: dark)';

export type DashboardTheme = 'light' | 'dark';

export function resolveDashboardTheme(): DashboardTheme {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = localStorage.getItem(DASHBOARD_THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    /* ignore unavailable storage */
  }
  return window.matchMedia(DASHBOARD_THEME_MEDIA_QUERY).matches ? 'dark' : 'light';
}

export function hasStoredDashboardTheme(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const stored = localStorage.getItem(DASHBOARD_THEME_STORAGE_KEY);
    return stored === 'dark' || stored === 'light';
  } catch {
    return false;
  }
}

export function persistDashboardTheme(mode: DashboardTheme): void {
  try {
    localStorage.setItem(DASHBOARD_THEME_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

/** Apply theme classes on `document.documentElement`; returns cleanup for effect teardown. */
export function applyDashboardThemeToDocument(theme: DashboardTheme): () => void {
  const root = window.document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
  }
  return () => {
    root.classList.remove('dark');
    root.style.colorScheme = '';
  };
}

export type DashboardThemeFlashScope =
  | { kind: 'path-prefix'; prefix: string }
  | { kind: 'exclude-paths'; paths: string[] };

/**
 * Inline script for root layout `<head>` to prevent theme flash before hydration.
 * Uses the same storage key as tenant web so theme preference follows the user.
 */
export function buildDashboardThemeFlashScript(
  scope: DashboardThemeFlashScope = { kind: 'exclude-paths', paths: ['/login'] },
): string {
  const scopeCheck =
    scope.kind === 'path-prefix'
      ? `path.indexOf(${JSON.stringify(scope.prefix)}) === 0`
      : `![${scope.paths.map((p) => JSON.stringify(p)).join(', ')}].some(function(p) { return path === p || path.indexOf(p + '/') === 0; })`;

  return `(function(){try{var path=window.location.pathname;if(!(${scopeCheck}))return;var theme=localStorage.getItem(${JSON.stringify(DASHBOARD_THEME_STORAGE_KEY)});var supportDark=window.matchMedia(${JSON.stringify(DASHBOARD_THEME_MEDIA_QUERY)}).matches;if(theme==='dark'||(!theme&&supportDark)){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}else{document.documentElement.classList.remove('dark');document.documentElement.style.colorScheme='light';}}catch(e){}})();`;
}

/** Shared page heading class for dashboard surfaces (web + loyalty). */
export const DASHBOARD_PAGE_HEADING_CLASS = 'text-foreground text-2xl font-semibold tracking-tight';
