import { cookies, headers } from 'next/headers';
import { getLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing, getDirection, type AppLocale } from '@/i18n/routing';
import { LOCALE_COOKIE } from '@/i18n/localeCookie';

/**
 * FIX (پنل ادمین دوزبانه): پنل ادمین بیرون از [locale] رندر می‌شود، پس next-intl
 * خودش زبانی برای آن پیدا نمی‌کند و به defaultLocale برمی‌گردد. این تابع همان
 * اولویت‌های سایت را بازسازی می‌کند:
 *   1) هدر X-Admin-Locale که proxy روی درخواست‌های /admin* ست می‌کند
 *      (خودش کوکی ORBIT_LOCALE را خوانده — منبع واحد حقیقت)
 *   2) مستقیم خواندن کوکی ORBIT_LOCALE (fallback اگر proxy اجرا نشده باشد)
 *   3) پیشوند زبان در query (?locale=fa) — فقط وقتی معتبر باشد؛ هم‌زمان
 *      سوییچر با نوشتن کوکی، pathname را replace می‌کند تا لینک تمیز بماند
 *   4) وگرنه defaultLocale (en)
 */
export async function resolveAdminLocale(): Promise<AppLocale> {
  const valid = (v: string | undefined | null): v is AppLocale =>
    !!v && hasLocale(routing.locales, v);

  // FIX (باگ «رفرش=فارسی، ناوبری client-side=انگلیسی» — ریشه‌ای):
  // ترتیب اولویت جدید بر پایه این واقعیت next-intl ساخته شده که
  // setRequestLocale() در React.cache **همان request** ذخیره می‌شود؛ یعنی اگر
  // layout همین الان فارسی رندر کرده، تصمیم او برای همه سِگمنت‌های همان رندر
  // معتبر است. اما در **ناوبری client-side** (کلیک روی سایدبار) Next فقط
  // سِگمنت page را با request-config تازه اجرا می‌کند و layout دوباره اجرا
  // نمی‌شود؛ آنجا getLocale()/requestLocale برابر 'en' است چون هدر
  // X-NEXT-INTL-LOCALE فقط روی درخواست HTML اولیه ست می‌شود (RSC fetchها
  // کوکی ORBIT_LOCALE را دارند ولی پروکسی این شاخه را قبلاً هدر نمی‌داد).
  // پس برنده مطلق باید «تصمیم صریح کاربر» باشد: پارامتر ?locale → هدر
  // x-admin-locale (=کوکی) → خودِ کوکی ORBIT_LOCALE → تصمیم next-intl.
  // (0) انتخاب صریح از URL — برنده مطلق است چون کاربر همین الان روی سوییچر کلیک کرده.
  try {
    const q = new URL((await headers()).get('x-admin-url') ?? '', 'http://n').searchParams.get('locale');
    if (valid(q)) return q;
  } catch {
    /* headers در context غیرداینامیک در دسترس نیست */
  }

  // (1) تصمیم پروکسی — روی درخواست‌های HTML و RSC ست می‌شود؛ در ناوبری
  // client-side تنها منبع معتبرِ هم‌زمان با رندر همین است (layout دوباره
  // اجرا نمی‌شود تا setRequestLocale تازه بخواند).
  try {
    const h = (await headers()).get('x-admin-locale');
    if (valid(h)) return h;
  } catch {
    /* headers در context غیرداینامیک */
  }

  // (2) کوکی انتخاب کاربر — fallback اگر proxy اجرا نشده باشد (مثلاً تست مستقیم
  // dev بدون edge) یا هدر در مسیر RSC به هر دلیلی نرسیده باشد.
  try {
    const c = (await cookies()).get(LOCALE_COOKIE)?.value;
    if (valid(c)) return c;
  } catch {
    /* static context */
  }

  // (3) تصمیم خود next-intl در این request (هدر X-NEXT-INTL-LOCALE که proxy
  // حالا برای /admin* هم ست می‌کند، یا setRequestLocale والد) — گام همگرایی:
  // اگر همه منابع بالا خاموش بودند، حداقل با Provider/messages همان رندر یکی بمانیم.
  try {
    const auto = await getLocale();
    if (valid(auto)) return auto;
  } catch {
    /* noop */
  }

  return routing.defaultLocale;
}

export { getDirection };
