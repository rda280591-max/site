// ORBIT — قالب‌بندی اعداد
//
// همه‌ی توابع زبان را «صریح» می‌گیرند (پارامتر locale) و به هیچ حالت سراسری
// تکیه نمی‌کنند. دلیلش دو چیز است:
//   1) این توابع از کامپوننت‌های کلاینت صدا زده می‌شوند؛ اگر زبان را از یک
//      متغیر ماژولی می‌خواندند، خروجی به ترتیب هیدریشن وابسته می‌شد و
//      ناهم‌خوانی سرور/کلاینت (hydration mismatch) می‌ساخت.
//   2) یک ماژول سراسری «زبان فعال» در اپ چندزبانه به‌سرعت به منبع حقیقت دوم
//      تبدیل می‌شود؛ در حالی که تنها منبع حقیقت باید next-intl باشد.
//
// پیش‌فرض 'fa' است تا فراخوانی‌های قدیمی رفتار قبلی را حفظ کنند، ولی همه‌ی
// نقاط استفاده در UI الان صریحاً زبان فعال را پاس می‌دهند.

import type { AppLocale } from '@/i18n/routing';

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/** Maps Latin digits to Persian digits (for Persian display only). */
export function toPersianDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

/** Converts digits to the locale's numeral system. */
function localizeDigits(input: string | number, locale: AppLocale): string {
  return locale === 'fa' ? toPersianDigits(input) : String(input);
}

/**
 /* Thousands separator.
 *
 * عمداً از toLocaleString استفاده نمی‌کنیم: برای fa-IR خروجی مرورگرها یکسان
 * نیست و رقمی‌شدن دوباره‌ی آن هم غیرقابل‌پیش‌بینی است. پس گروه‌بندی را خودمان
 * انجام می‌دهیم و بعد ارقام را بر اساس زبان تبدیل می‌کنیم.
 */
function groupDigits(value: number): string {
  const [int, frac] = String(value).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac ? `${grouped}.${frac}` : grouped;
}

export function formatNumber(value: number, locale: AppLocale = 'fa'): string {
  if (!Number.isFinite(value)) return '—';
  return localizeDigits(groupDigits(value), locale);
}

export function formatCompact(value: number, locale: AppLocale = 'fa'): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs < 1000) return localizeDigits(String(value), locale);

  // Scale suffixes use the user's own language: K/M/B in English, Persian words in fa.
  const [divisor, fa, en] =
    abs < 1_000_000
      ? [1_000, 'هزار', 'K']
      : abs < 1_000_000_000
        ? [1_000_000, 'میلیون', 'M']
        : [1_000_000_000, 'میلیارد', 'B'];

  return `${localizeDigits((value / divisor).toFixed(1), locale)} ${locale === 'fa' ? fa : en}`;
}

export function formatPercent(value: number, digits = 0, locale: AppLocale = 'fa'): string {
  if (!Number.isFinite(value)) return '—';
  // Percent sign is U+066A in Persian, % in English.
  const sign = locale === 'fa' ? '٪' : '%';
  return `${localizeDigits(value.toFixed(digits), locale)}${sign}`;
}

export function safeString(value: unknown, fallback = '—'): string {
  if (value === null || value === undefined) return fallback;
  const s = String(value).trim();
  return s.length ? s : fallback;
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}