'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { useSettingsStore, applyTheme } from '@/state/settingsStore';
import type { ThemeMode } from '@/types/common';

const emptySubscribe = () => () => undefined;

/**
 * تم از استور تنظیمات خوانده می‌شود (منبع حقیقت واحد).
 * اعمال واقعی روی <html> توسط settingsStore.applyTheme انجام می‌شود.
 */
export function useTheme() {
  const theme = useSettingsStore((s) => s.theme);
  const setStoredTheme = useSettingsStore((s) => s.set);
  // true only on the client; false on the server to keep hydration stable.
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  // Effective value for the icon (dark/light).
  let resolved: 'dark' | 'light' = theme === 'system' ? 'dark' : theme;
  if (theme === 'system' && mounted && typeof window !== 'undefined') {
    resolved = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  // FIX (باگ گزارش‌شده: «سوییچ تم/زبان، تم را عوض می‌کند»):
  // تم در localStorage زنده است و layout سروری پنل (/admin بیرون از [locale])
  // از آن بی‌خبر بود؛ router.refresh (سوییچ زبان / Server Action) پنل را با
  // تم پیش‌فرض برمی‌گرداند. حالا مقدار قابل‌اعمال در کوکی ORBIT_THEME هم
  //镜像 می‌شود تا layout سرور-اWARE رندر کند.
  useEffect(() => {
    try {
      document.cookie = `ORBIT_THEME=${resolved}; path=/; max-age=31536000; samesite=lax`;
    } catch {
      /* storage مسدود — applyTheme همچنان کار می‌کند */
    }
  }, [resolved]);

  const setTheme = (t: ThemeMode) => setStoredTheme('theme', t);

  const toggleTheme = () => {
    setStoredTheme('theme', resolved === 'dark' ? 'light' : 'dark');
  };

  return { theme: resolved, mode: theme, mounted, toggleTheme, setTheme, applyTheme };
}

export default useTheme;