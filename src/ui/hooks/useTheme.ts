'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';

const emptySubscribe = () => () => undefined;

type Theme = 'dark' | 'light';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark';
    try {
      const saved = localStorage.getItem('orbit-theme');
      return saved === 'light' || saved === 'dark' ? saved : 'dark';
    } catch {
      return 'dark';
    }
  });
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  // Synchronize the document theme without triggering a render from an effect.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // تغییر تم
  const toggleTheme = () => {
    setThemeState((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', next);
        try {
          localStorage.setItem('orbit-theme', next);
        } catch {
          // ignore
        }
      }
      return next;
    });
  };

  const setTheme = (t: Theme) => {
    setThemeState(t);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', t);
      try {
        localStorage.setItem('orbit-theme', t);
      } catch {
        // ignore
      }
    }
  };

  return { theme, mounted, toggleTheme, setTheme };
}