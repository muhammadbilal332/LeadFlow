import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

/** Per-device preference, so the choice survives reloads on the same browser. */
export const THEME_STORAGE_KEY = 'sellerclutch-theme';

export function readStoredTheme(): Theme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    // Storage can be blocked (private windows, disabled site data); default to light.
    return 'light';
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
}

// The layout mounts more than one ThemeToggle at once (a mobile header and a
// desktop header, swapped by CSS breakpoint rather than unmounted), so each
// component's own useState would drift out of sync with the others and with
// the actually-applied theme. This module-level value plus a subscriber list
// keeps every mounted instance in step with whichever one changed it.
let currentTheme: Theme = readStoredTheme();
const listeners = new Set<(theme: Theme) => void>();

export function useTheme(): { theme: Theme; setTheme: (theme: Theme) => void } {
  const [theme, setThemeState] = useState<Theme>(currentTheme);

  useEffect(() => {
    listeners.add(setThemeState);
    return () => {
      listeners.delete(setThemeState);
    };
  }, []);

  const setTheme = useCallback((next: Theme) => {
    currentTheme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Ignore: the theme still applies for this visit.
    }
    applyTheme(next);
    listeners.forEach((listen) => listen(next));
  }, []);

  return { theme, setTheme };
}
