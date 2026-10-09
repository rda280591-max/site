'use client';

import { useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { AppLocale } from '@/i18n/routing';
import { readLocaleCookie, writeLocaleCookie, reapplyThemeAfterServerRender } from '@/services/admin/adminLocaleClient';

/**
 * همگام‌ساز دوطرفه کوکی زبان ⇄ رندر پنل — بدون reload.
 *
 * FIX (باگ واقعی گزارش‌شده توسط کاربر: «باید حتماً رفرش کنی تا فارسی شود؛
 * بعد اگر به تب دیگر بروی باز انگلیسی است»):
 * دو مسیر نشتی وجود داشت:
 *   1) سوییچر قدیمی فقط با window.location جابه‌جا می‌شد و در برخی حالت‌ها
 *      (کوکی مسدود/قدیمی) تصمیم سرور و کوکی از هم واگرا می‌ماندند؛ هر ناوبری
 *      client-side بعدی بر پایه کوکی (هدر پروکسی) زبان قبلی را برمی‌گرداند.
 *   2) اگر پارامتر ?locale= در URL می‌ماند، لینک‌های کپی‌شده/بوک‌مارک‌ها به
 *      یک زبان قفل می‌شدند و با کوکی جدیدِ کاربر می‌جنگیدند.
 *
 * اینجا بعد از هر رندر، **هر دو** منبع (کوکی + پاک‌سازی URL) را با تصمیم
 * سرور یکی می‌کنیم. اگر کوکی هنوز ننشسته باشد (مثلاً privacy mode)، نوشتن
 * دوباره تلاش می‌شود؛ در بدترین حالت همان رندر سروری درست است و Sync بعدی
 * ترمیم می‌کند. هیچ re-render خودسرانه‌ای ایجاد نمی‌کند.
 */
export default function AdminLocaleSync({ serverLocale }: { serverLocale: AppLocale }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // FIX (باگ گزارش‌شده: «سوییچ تم/زبان، تم را عوض می‌کند»):
  // هر رندر سروری جدید (refresh لاگین، refresh سوییچر زبان، و ریفچ خودکار
  // بعد از Server Action ذخیره/حذف) layout ادمین را با data-theme هاردکد
  // دوباره می‌فرستد و تم کاربر را خراب می‌کند. این effect روی [pathname] هم
  // اجرا می‌شود تا بعد از هر ناوبری/ریفچ، تم ذخیره‌شده بلافاصله بازگردانده
  // شود؛ applyTheme idempotent است و در حالت عادی فقط یک setAttribute بی‌اثر
  // انجام می‌دهد (بدون re-render، بدون فلش).
  useEffect(() => {
    reapplyThemeAfterServerRender();
  }, [pathname, serverLocale]);

  useEffect(() => {
    // (1) کوکی باید همیشه برابر تصمیم سرور باشد تا ناوبری بعدی (client-side)
    //     همان زبان را از هدر پروکسی بگیرد — بدون F5.
    if (readLocaleCookie() !== serverLocale) writeLocaleCookie(serverLocale);

    // (2) پاک‌کردن پارامتر موقت ?locale= وقتی سرور آن را اعمال کرده است؛
    //     این کار history.replaceState انجام می‌دهد (بدون notify شدن Next)،
    //     پس یک بار router.refresh لازم است تا useSearchParams و effect های
    //     وابسته به آن stale نشوند. refresh روی همان pathname بی‌هزینه است
    //     چون layout/page هر دو force-dynamic هستند و نتیجه یکسان می‌ماند.
    const urlLocale = searchParams.get('locale');
    if (urlLocale && urlLocale === serverLocale) {
      const clean = new URL(window.location.href);
      clean.searchParams.delete('locale');
      window.history.replaceState(null, '', clean.pathname + clean.search + clean.hash);
      router.refresh();
    }
  }, [serverLocale, searchParams, router]);

  return null;
}
