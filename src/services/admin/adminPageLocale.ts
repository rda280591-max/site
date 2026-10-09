import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing, type AppLocale } from '@/i18n/routing';
import { resolveAdminLocale } from './adminLocale';

/**
 * FIX (باگ واقعی — «رفرش/تب دیگر = انگلیسی»):
 * صفحات /admin/* همگی `force-dynamic` هستند، اما در Next.js App Router وقتی
 * layout یک path را رندر می‌کند، صفحه (page) در **سِگمنت جداگانه** و با
 * request-config تازه اجرا می‌شود. اگر آن صفحه `setRequestLocale` صدا نزند،
 * next-intl زبان را از URL می‌گیرد؛ چون پنل بیرون از `[locale]` است و پیشوند
 * زبانی ندارد، همیشه defaultLocale ('en') برمی‌گردد. نتیجه:
 *   - سوییچ به فارسی کار می‌کرد فقط تا زمانی که همان فریم از cache layout
 *     سرو می‌شد؛ یک refresh یا رفتن به تب دیگر → صفحه دوباره انگلیسی.
 *
 * راه‌حل: هر صفحه ادمین قبل از هر getTranslations() این تابع را صدا بزند تا
 * تصمیم layout (کوکی ORBIT_LOCALE / هدر پروکسی / ?locale=) در همان ریکوئست
 * به next-intl تزریق شود. ارزان و idempotent است.
 */
export async function applyAdminPageLocale(): Promise<AppLocale> {
  const locale = await resolveAdminLocale();
  if (hasLocale(routing.locales, locale)) {
    setRequestLocale(locale);
  }
  return locale;
}
/**
 * FIX (باگ «عنوان انگلیسی، بقیه فارسی» — گزارش زنده کاربر):
 * ترجمه‌های صفحات ادمین باید **صریحاً** با همان locale‌ای ساخته شوند که layout
 * برای Provider/messages تصمیم گرفته است. اگر getTranslations بدون آرگومان
 * صدا زده شود، next-intl در request-config همان سِگمنت تصمیم می‌گیرد؛ هر
 * اختلاف/کشی بین layout و page → fallback به defaultLocale ('en') فقط برای
 * عنوان، در حالی که بقیه UI (Provider کلاینت) فارسی می‌ماند.
 *
 * @param namespace زیر-namespace کامل پنل مثل 'admin.news' | 'admin.feeds'.
 */
export async function adminPageTranslations(namespace: string) {
  const locale = await applyAdminPageLocale();
  // @ts-expect-error — AppConfig پروژه GlobalPrefixes را محدود به 'time' تعریف
  // کرده، ولی الگوی موجود پنل از پیشوند runtime 'admin' استفاده می‌کند
  // (useTranslations('admin.news') در کامپوننت‌ها). اینجا همان الگو با locale
  // صریح تکرار می‌شود؛ اعتبار کلیدها در runtime و تست‌های messages پوشش دارد.
  return getTranslations({ locale, namespace });
}
