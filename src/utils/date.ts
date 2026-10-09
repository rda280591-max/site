// ORBIT — ابزارهای تاریخ
//
// مثل formatters، زبان صریحاً پاس داده می‌شود تا این توابع در کامپوننت‌های
// کلاینت قابل استفاده باشند بدون ساختن حالت سراسری زبان.
//
// پیش‌فرض 'fa' برای حفظ رفتار فراخوانی‌های قدیمی است؛ UI الان زبان فعال را
// از useLocale می‌گیرد و پاس می‌دهد (وگرنه در حالت انگلیسی، تاریخ و «۳ روز پیش»
// فارسی می‌ماند).
import type { AppLocale } from '@/i18n/routing';
import { toPersianDigits } from './formatters';

/*
 * PERF — کش Intl.DateTimeFormat:
 * ساخت هر Intl.DateTimeFormat گران است (نگاشت locale/timezone/calendar).
 * قبلاً formatJalali/formatTime در «هر فراخوانی» یک instance تازه می‌ساختند؛
 * با ۲۰+ کارت در فید و رندرهای مکرر، این هزینه روی thread اصلی جمع می‌شد.
 * کلیدهای پیکربندی ثابت‌اند، پس چند instance محدود کافی است → O(1) در عمل.
 */
type DateFormatKey = 'fa-date' | 'en-date' | 'fa-time' | 'en-time';
const dateFormatCache = new Map<DateFormatKey, Intl.DateTimeFormat>();

function getCachedFormatter(key: DateFormatKey): Intl.DateTimeFormat {
  let fmt = dateFormatCache.get(key);
  if (!fmt) {
    switch (key) {
      case 'fa-date':
        fmt = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          timeZone: 'Asia/Tehran',
        });
        break;
      case 'en-date':
        fmt = new Intl.DateTimeFormat('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        break;
      case 'fa-time':
        fmt = new Intl.DateTimeFormat('fa-IR', {
          hour: '2-digit',
          minute: '2-digit',
          // Reference hour matters only for Persian; English uses the user's local time.
          timeZone: 'Asia/Tehran',
        });
        break;
      case 'en-time':
        fmt = new Intl.DateTimeFormat('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        });
        break;
    }
    dateFormatCache.set(key, fmt);
  }
  return fmt;
}

export function toDate(value: Date | number | string): Date | null {
  try {
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/**
 * تاریخ کامل کاربرپسند.
 * fa → تقویم هجری شمسی (Asia/Tehran)، en → تقویم میلادی.
 */
export function formatJalali(value: Date | number | string, locale: AppLocale = 'fa'): string {
  const d = toDate(value);
  if (!d) return '—';
  try {
    // PERF — از کش instance استفاده می‌شود (ساخت مجدد Intl در هر فراخوانی حذف شد).
    return getCachedFormatter(locale === 'fa' ? 'fa-date' : 'en-date').format(d);
  } catch {
    return d.toLocaleDateString(locale === 'fa' ? 'fa-IR' : 'en-US');
  }
}

export function formatTime(value: Date | number | string, locale: AppLocale = 'fa'): string {
  const d = toDate(value);
  if (!d) return '—';
  try {
    // PERF — کش‌شده؛ رفتار دقیقاً مثل قبل (fa با Asia/Tehran، en با زمان محلی).
    return getCachedFormatter(locale === 'fa' ? 'fa-time' : 'en-time').format(d);
  } catch {
    return d.toLocaleTimeString(locale === 'fa' ? 'fa-IR' : 'en-US');
  }
}

/**
 /* Relative time span ("3 days ago" or its Persian equivalent).
 *
 * واحدها از دیکشنری زبان می‌آیند نه متن ثابت؛ کلیدها در namespace «time»
 * در messages/{locale}.json تعریف شده‌اند و اینجا از طریق پارامتر units
 * تزریق می‌شوند تا این ماژول (که هوک React نیست) به next-intl وابسته نشود.
 */
export interface RelativeUnits {
  now: string;
  future: string;
  minute: string;
  hour: string;
  day: string;
  month: string;
  year: string;
}

export function formatRelative(
  value: Date | number | string,
  locale: AppLocale = 'fa',
  units?: RelativeUnits,
): string {
  const d = toDate(value);
  if (!d) return '—';

  const digits = (n: number) =>
    locale === 'fa' ? toPersianDigits(n) : String(n);

  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 0) return units?.future ?? (locale === 'fa' ? 'آینده' : 'in the future');
  if (sec < 60) return units?.now ?? (locale === 'fa' ? 'همین حالا' : 'just now');

  const min = Math.floor(sec / 60);
  if (min < 60) return `${digits(min)} ${units?.minute ?? 'دقیقه پیش'}`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${digits(hr)} ${units?.hour ?? 'ساعت پیش'}`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${digits(day)} ${units?.day ?? 'روز پیش'}`;
  const mon = Math.floor(day / 30);
  if (mon < 12) return `${digits(mon)} ${units?.month ?? 'ماه پیش'}`;
  return `${digits(Math.floor(mon / 12))} ${units?.year ?? 'سال پیش'}`;
}

export function isToday(value: Date | number | string): boolean {
  const d = toDate(value);
  if (!d) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}