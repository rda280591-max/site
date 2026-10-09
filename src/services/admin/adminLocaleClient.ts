import type { AppLocale } from '@/i18n/routing';
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from '@/i18n/localeCookie';

/** خواندن کوکی ORBIT_LOCALE در کلاینت (undefined اگر نبود/مسدود بود). */
export function readLocaleCookie(): AppLocale | undefined {
  try {
    const m = document.cookie.match(new RegExp('(?:^|; )' + LOCALE_COOKIE + '=([^;]*)'));
    const v = m ? decodeURIComponent(m[1]) : undefined;
    return v === 'fa' || v === 'en' ? v : undefined;
  } catch {
    return undefined; // privacy mode / restricted storage
  }
}

export function writeLocaleCookie(next: AppLocale): void {
  try {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
  } catch {
    /* نوشتن نشد؟ پارامتر ?locale در URL تکلیف را روشن می‌کند */
  }
}

/**
 * FIX (باگ گزارش‌شده: «سوییچ تم یا زبان، تم را عوض می‌کند»):
 * router.refresh() در Next.js یک ریفچ RSC کامل است و layout ادمین
 * force-dynamic؛ هر بار که layout دوباره روی سرور اجرا می‌شود، wrapper با
 * data-theme="dark" هاردکد رندر می‌شود و اگر کاربر تمش light باشد، همان
 * refresh تم را به dark برمی‌گرداند. چون <html> مشترک بین دو درخت است،
 * این مقدار اشتباه تا hydrate شدن settingsStore هم باقی می‌ماند.
 * راه‌حل: بلافاصله بعد از هر refresh، تم ذخیره‌شده کاربر دوباره اعمال شود.
 */
export function reapplyThemeAfterServerRender(): void {
  if (typeof window === 'undefined') return;
  // import داینامیک: settingsStore کلاینت-محور است و نباید به باندل سرور کشیده شود.
  void import('@/state/settingsStore').then(({ useSettingsStore, applyTheme }) => {
    applyTheme(useSettingsStore.getState().theme);
  });
}
