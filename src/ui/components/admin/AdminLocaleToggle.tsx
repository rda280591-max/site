'use client';

import { useRouter, usePathname } from 'next/navigation';
import { startTransition } from 'react';
import { LOCALE_LABELS, getDirection, type AppLocale } from '@/i18n/routing';
import { writeLocaleCookie, reapplyThemeAfterServerRender } from '@/services/admin/adminLocaleClient';

/**
 * سوییچر زبان پنل ادمین (en ⇄ fa)
 *
 * FIX (باگ واقعی — «رفرش/تب دیگر = انگلیسی»): نسخه قبلی با window.location.href
 * جابه‌جایی کامل (hard nav) می‌کرد؛ یعنی هر بار سوییچ، reload کل صفحه لازم بود.
 * ریشه مشکل این بود که `router.replace` روی همان pathname فقط search را عوض
 * می‌کند و layout سرور را re-run **نمی‌کند**؛ در نتیجه Next یک فریم قدیمیِ
 * cache شده (انگلیسی) نشان می‌داد مگر اینکه کاربر دستی F5 بزند.
 *
 * راه‌حل استاندارد next-intl برای مسیرهای بیرون از [locale]:
 *   1) نوشتن کوکی ORBIT_LOCALE (منبع حقیقت — proxy آن را به هدر X-Admin-Locale
 *      ترجمه می‌کند و resolveAdminLocale در layout/page می‌خواند)
 *   2) حذف پارامتر ?locale= از URL تا لینک تمیز بماند (Sync بعدی هم کوکی را
 *      تأیید می‌کند)
 *   3) startTransition + router.refresh() — طبق مستندات رسمی next-intl، refresh
 *      بعد از تغییر locale تنها راه معتبر است؛ چون layout ما force-dynamic است،
 *      refresh واقعاً layout را روی سرور دوباره اجرا می‌کند و key={locale}
 *      درخت را کامل بازترجمه/re-mount می‌کند — بدون هیچ reload مرورگر.
 */
export default function AdminLocaleToggle({ locale }: { locale: AppLocale }) {
  const router = useRouter();
  const pathname = usePathname();
  const other: AppLocale = locale === 'en' ? 'fa' : 'en';

  function switchTo(next: AppLocale) {
    if (next === locale) return;
    writeLocaleCookie(next);

    // اگر پارامتر موقتی از سوییچ قبلی مانده، پاکش کنیم تا برنده نشود
    const url = new URL(pathname + window.location.search, window.location.origin);
    const hadParam = url.searchParams.has('locale');
    url.searchParams.delete('locale');

    // prefetch مسیر مقصد برای ناوبری بعدی (ارزان، side-effect ندارد)
    router.prefetch(url.pathname + url.search);

    // refresh باید داخل transition صدا زده شود تا React آن را با state جدید
    // merge کند (الگوی رسمی next-intl useSetLocale).
    startTransition(() => {
      if (hadParam) {
        // replace باعث می‌شود searchParams کلاینت هم به‌روز بماند (وگرنه
        // فقط history.replaceState که Next را notify نمی‌کند).
        router.replace(url.pathname + url.search);
      }
      router.refresh();
      // FIX: refresh، layout سرور را دوباره با data-theme هاردکد اجرا می‌کند؛
      // تم کاربر بلافاصله بازگردانده می‌شود تا سوییچ زبان، تم را خراب نکند.
      reapplyThemeAfterServerRender();
    });
  }

  const label = LOCALE_LABELS[other].native;

  return (
    <button
      type="button"
      onClick={() => switchTo(other)}
      lang={other}
      dir={getDirection(other)}
      title={other === 'fa' ? 'تغییر به فارسی' : 'Switch to English'}
      aria-label={`Switch language: ${label}`}
      data-testid="admin-locale-toggle"
      className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-bold text-slate-200 transition-colors hover:border-cyan-400/40 hover:bg-white/10 md:w-auto"
    >
      <span aria-hidden>{LOCALE_LABELS[other].flag}</span>
      <span>{label}</span>
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M8 7h12M8 7l-3 3M8 7 5 4" />
        <path d="M16 17H4M16 17l3-3M16 17l3 3" />
      </svg>
    </button>
  );
}
