import type { ReactNode } from "react";
/* FIX — استایل سراسری: قبلاً globals.css فقط داخل [locale]/layout ایمپورت می‌شد؛
 * مسیرهای بیرون از [locale] (مثل /admin) بدون هیچ CSS رندر می‌شدند و Tailwind
 * v4 هم کلاس‌های آنجا را در بیلد اسکن نمی‌کرد. ایمپورت در root layout تضمین
 * می‌کند استایل در همه درخت‌های رندر موجود است. */
import "./globals.css";

/*
 /* ORBIT — Root Layout
 *
 * در App Router فقط *یک* <html> مجاز است و آن باید در root layout باشد.
 * تگ <html> واقعی در src/app/[locale]/layout.tsx قرار دارد (چون lang/dir
 * به زبان فعال بستگی دارد). اینجا یک Fragment خالی برمی‌گردانیم تا:
 *   - Next.js از ما <html> نخواهد (رفع خطای type-check در build)،
 *   - از رندر دوباره‌ی <html> در هر درخواست جلوگیری شود (بهبود TTFB/Performance)،
 *   - اسکریپت تم و preconnect فونت دقیقاً یک بار و پیش از render اعمال شوند.
 */
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <>{children}</>;
}
