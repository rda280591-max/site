import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { requireAdmin } from '@/services/admin/adminGuard';
import { resolveAdminLocale } from '@/services/admin/adminLocale';
import AdminLocaleSync from '@/ui/components/admin/AdminLocaleSync';
// FIX (UI زنده / فونت): Vazirmatn با همان متغیر --font-vazirmatn در پنل هم
// اعمال می‌شود. قبلاً کلاس variable فقط روی <html> درخت [locale] بود و پنل
// (/admin بیرون از [locale]) به fallback سیستمی می‌افتاد — در فارسی یعنی
// ناخوانا/تقویمی. import مستقیم next/font مجاز است؛ next نسخه self-hosted
// یکسانی را serve می‌کند و preload اضافه‌ای ایجاد نمی‌شود.
import { Vazirmatn } from 'next/font/google';
import "../globals.css"; // FIX — استایل پنل ادمین (بیرون از [locale])
import "./admin.css"; // لایه ظاهری اختصاصی پنل (بدون اثر روی باندل سایت عمومی)
import AdminSidebar from '@/ui/components/admin/AdminSidebar';
import AdminMobileNav from '@/ui/components/admin/AdminMobileNav';

const vazirmatn = Vazirmatn({
  subsets: ['arabic', 'latin'],
  display: 'swap',
  variable: '--font-vazirmatn',
});

// داینامیک: گارد نشست نباید در build اجرا شود (کوکی وجود ندارد)
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'ORBIT Admin',
  robots: { index: false, follow: false }, // ایندکس نشود
};

/**
 * چارچوب پنل ادمین — گارد سمت سرور (getUser + role=admin) قبل از رندر هر فریم.
 * JS ادمین فقط هنگام ورود به این مسیرها دانلود می‌شود (code-split طبیعی App Router).
 *
 * FIX (پنل ادمین دوزبانه): پنل بیرون از [locale] است، پس زبان را خودمان از
 * کوکی ORBIT_LOCALE / هدر پروکسی / ?locale= استخراج و به next-intl تزریق
 * می‌کنیم (setRequestLocale + Provider با messages همان زبان). جهت RTL هم
 * روی wrapper ست می‌شود تا چیدمان سایدبار/جدول‌ها فارسی‌محور شود؛ <html>
 * مشترک با روت layout خالی نمی‌شود چون [locale]/layout نسخه خودش را دارد.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const locale = await resolveAdminLocale();
  // FIX (باگ گزارش‌شده: «سوییچ تم/زبان، تم را عوض می‌کند»):
  // تم در localStorage زنده است و سرور از آن بی‌خبر است؛ اما چون <html> بین
  // دو درخت مشترک است، اسکریپت ضدفلشِ layout سایت مقدار درست را روی
  // documentElement می‌نشیند. قبلاً wrapper پنل data-theme="dark" هاردکد داشت
  // که specificity بالاتر CSS را گمراه می‌کرد؛ حالا از همان کلید خام خوانده
  // و سرور-اWARE رندر می‌شود (کوکی ORBIT_THEME توسط useTheme نوشته می‌شود).
  let theme: 'dark' | 'light' = 'dark';
  try {
    const c = (await cookies()).get('ORBIT_THEME')?.value;
    if (c === 'light' || c === 'dark') theme = c;
  } catch {
    /* static context — پیش‌فرض dark */
  }
  // NOTE: setRequestLocale اینجا فقط «همین» request را تنظیم می‌کند. صفحات
  // /admin/* در سِگمنت مستقل با request-config تازه اجرا می‌شوند و هر کدام
  // خودشان applyAdminPageLocale() را صدا می‌زنند (FIX ریشه‌ای باگ
  // «رفرش/تب دیگر = انگلیسی»). این layout عمداً force-dynamic است تا cache
  // بین سوییچ‌های زبان نماند.
  setRequestLocale(locale);

  const [{ email }, messages] = await Promise.all([requireAdmin(), getMessages()]);
  const dir = locale === 'fa' ? 'rtl' : 'ltr';

  return (
    // FIX (رفرش‌زدایی ریشه‌ای): key={locale} باعث می‌شود هنگام سوییچ زبان،
    // درخت ادمین روی سرور کامل rebuild شود — یعنی حتی کامپوننت‌هایی که متن
    // ترجمه‌شده را در useState خود نگه داشته‌اند (مثل فرم‌های NewsManager و
    // FeedsManager) به‌جای ماندن با رشته‌های قدیمیِ همان session، با زبان نو
    // re-mount و بازترجمه می‌شوند. بدون این، فقط t()های رندر زنده عوض می‌شدند
    // و کاربر مجبور به refresh واقعی می‌گشت.
    <NextIntlClientProvider key={locale} locale={locale} messages={messages}>
      {/* همگام‌ساز کوکی زبان: اگر کاربر از سوییچر سایت (خارج پنل) زبان را
          عوض کرده باشد، همین‌جا پنل را هم (بدون reload) هم‌زبان می‌کند */}
      <AdminLocaleSync serverLocale={locale} />
      {/* lang روی wrapper به‌جای html: کمک به رندر صحیح فونت/جهت متن در هر دو زبان */}
      <div lang={locale} dir={dir} data-theme={theme} className={`admin-shell min-h-screen text-slate-100 ${vazirmatn.variable}`}>
        <div className="flex min-h-screen">
          <AdminSidebar email={email} locale={locale} />
          {/* FIX (UX موبایل): زیر md سایدبار مخفی است؛ نوار پایین + منوی کشویی
              جای آن را می‌گیرند تا تب‌ها، سوییچ زبان و خروج در دسترس بمانند. */}
          <AdminMobileNav email={email} locale={locale} />
          {/* max-width + m-auto: محتوا روی مانیتور عریض به‌جای کشیدگی بی‌هدف،
              ستون خوانا با همان ریتم سایدبار می‌گیرد — عادت واقعی طراحها. */}
          {/* FIX (منو همبرگری): ارتفاع نوار بالا h-14 + safe-area است؛ padding
              محتوا باید دقیقاً همان‌قدر باشد وگرنه اولین کارت زیر هدر چسبان
              پنهان می‌ماند. پایین = نوار تب‌ها (min-h 52px) + safe-area. */}
          <main id="admin-main" className="admin-main-scroll min-w-0 flex-1 p-4 pt-[calc(3.5rem+env(safe-area-inset-top)+0.75rem)] pb-[calc(3.5rem+env(safe-area-inset-bottom)+0.75rem)] sm:p-7 sm:pt-[calc(3.5rem+1.75rem)] sm:pb-9 lg:p-9">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </NextIntlClientProvider>
  );
}
