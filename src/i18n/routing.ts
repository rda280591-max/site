import { defineRouting } from 'next-intl/routing'

/**
 /* ORBIT — multilingual routing configuration
 *
 * en → زبان پیش‌فرض و اصلی (LTR)
 * fa → زبان دوم (RTL)
 *
 /* localePrefix: 'always' means every path carries a locale prefix: /en/login, /fa/login
 *
 * مهم برای «پیش‌فرض انگلیسی»:
 * localeDetection: false تشخیص خودکار زبان از هدر Accept-Language (و کوکی‌های
 * زبان قدیمی) را خاموش می‌کند. پس تکلیف زبان را فقط یکی از این دو تعیین می‌کند:
 *   1) پیشوند واضح در آدرس → مثلاً /fa/notes
 *   2) کوکی انتخاب کاربر   → ORBIT_LOCALE
 /* And if neither exists -> defaultLocale, i.e. 'en'.
 *
 * نکته: با localeCookie:false خودِ next-intl هیچ کوکی زبان ست نمی‌کند (که انگیزه‌ی
 * یک بارگذاری کامل اضافی هم می‌شد)؛ تنها منبع حقیقت، ORBIT_LOCALE است که سوییچر
 * زبان در مرورگر می‌نویسد و proxy.ts می‌خواند.
 */
export const routing = defineRouting({
  locales: ['en', 'fa'],
  defaultLocale: 'en',
  localePrefix: 'always',

  /** Locale only from explicit user choice or URL prefix — never from browser language. */
  localeDetection: false,

  /**
   /* Disable next-intl's own locale cookie.
   *
   * زبان از دو جا می‌آید: پیشوند آدرس، یا کوکی خودمان (ORBIT_LOCALE) که سوییچر
   * زبان می‌نویسد. با localeDetection:false این کوکی هیچ نقشی در تصمیم‌گیری
   * ندارد، ولی next-intl هنوز در هر درخواست سند آن را sync می‌کند؛ همین کار
   * باعث یک تعویض زبان غیرمنتظره و یک بارگذاری کامل اضافی می‌شد.
   * پس خاموشش می‌کنیم تا تنها منبع حقیقت، ORBIT_LOCALE بماند.
   */
  localeCookie: false,

  pathnames: {
    '/': '/',
    '/login': {
      en: '/login',
      fa: '/ورود',
    },
    '/news': {
      en: '/news',
      fa: '/اخبار',
    },
    '/notes': {
      en: '/notes',
      fa: '/یادداشت‌ها',
    },
    '/analytics': {
      en: '/analytics',
      fa: '/تحلیل',
    },
    '/settings': {
      en: '/settings',
      fa: '/تنظیمات',
    },
  },
})

export const pathnames = routing.pathnames

export type AppLocale = (typeof routing.locales)[number]
export type AppPathname = keyof typeof routing.pathnames

export const LOCALES = routing.locales

/** Text direction per locale */

/** Locale labels for the switcher; each language is named in its own language. */
export const LOCALE_LABELS: Record<AppLocale, { native: string; english: string; flag: string }> = {
  en: { native: 'English', english: 'English', flag: '🇬🇧' },
  fa: { native: 'فارسی', english: 'Persian', flag: '🇮🇷' },
}

export function getDirection(locale: string): 'ltr' | 'rtl' {
  return locale === 'fa' ? 'rtl' : 'ltr'
}