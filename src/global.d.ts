import type { routing } from '@/i18n/routing'
import type siteMessages from '../messages/en.json'
import type adminMessages from '../messages/admin.en.json'

/**
 /* ORBIT — next-intl global type definitions
 *
 * در next-intl نسخه‌ی ۴، قرارداد تایپ‌ها ازطریق interface «AppConfig» در
 * پکیج «use-intl» تعریف می‌شود (next-intl همان را دوباره صادر می‌کند).
 *
 * نتیجه: useTranslations و getTranslations کلیدها را type-safe می‌کنند؛
 * نوشتن کلید اشتباه خطای کامپایل می‌دهد، نه خطای runtime.
 *
 * FIX (دوزبانه‌سازی پنل ادمین): دیکشنری واقعی هر ریکوئست شامل namespace
 * «admin» است (در request.ts روی دیکشنری سایت merge می‌شود)، پس تایپ
 * سراسری هم باید هر دو را پوشش دهد تا کلیدهای پنل معتبر شمرده شوند.
 */
declare module 'use-intl' {
  interface AppConfig {
    /** Allowed locales: 'en' | 'fa' */
    Locale: (typeof routing.locales)[number]
    /** Valid message shape: site dictionary + admin panel namespace */
    Messages: typeof siteMessages & { admin: typeof adminMessages }
  }
}
