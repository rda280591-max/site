import { getRequestConfig } from 'next-intl/server'
import { hasLocale } from 'next-intl'
import { routing, type AppLocale } from './routing'
import enAdmin from '../../messages/admin.en.json'
import faAdmin from '../../messages/admin.fa.json'

/** دیکشنری پنل ادمین — import استاتیک به‌جای dynamic import با cast خطرناک */
const ADMIN_MESSAGES: Record<AppLocale, unknown> = { en: enAdmin, fa: faAdmin }

/**
 /* ORBIT — next-intl request configuration (App Router)
 /* Loads the message dictionary for that request's locale.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  // Requested locale is read from the [locale] segment.
  const requested = await requestLocale

  // Unsupported locales fall back to the default one.
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale

  return {
    locale,
    // FIX (پنل ادمین دوزبانه): پیام‌های پنل در فایل‌های جداگانه admin.<locale>.json
    // نگه داشته می‌شوند و اینجا به‌صورت namespace «admin» merge می‌شوند؛ صفحات
    // عمومی با namespace خودشان کار می‌کنند و تداخلی ندارند.
    messages: {
      ...(await import(`../../messages/${locale}.json`)).default,
      admin: ADMIN_MESSAGES[locale ?? routing.defaultLocale],
    },
    // For date/number formatting in redirects and Server Components
    timeZone: 'Asia/Tehran',
    now: new Date(),
  }
})