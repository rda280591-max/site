/**
 /* ORBIT — explicit user "language choice" cookie
 *
 * این فایل تنها جای تعریف نام/عمر کوکی زبان است؛ خودِ سوییچر زبان (LocaleToggle)
 * آن را در مرورگر می‌نویسد و proxy.ts آن را می‌خواند. next-intl عمداً
 * (localeCookie:false) هیچ کوکی زبان خودش را ست نمی‌کند تا دو منبع حقیقت نسازیم.
 *
 * چرا لازم است؟ چون حالت پیش‌فرض سایت باید انگلیسی باشد و زبان مرورگر کاربر
 * (Accept-Language) نباید آن را تغییر دهد. با localeDetection:false، زبان فقط
 * از «پیشوند آدرس» یا این کوکی تعیین می‌شود:
 *
 *   - کوکی موجود و یکی از زبان‌های مجاز → همان زبان
 *   - کوکی موجود و ناشناخته           → نادیده گرفته و برگشت به پیش‌فرض (en)
 *   - کوکی وجود ندارد                 → زبان پیش‌فرض (en)
 */

export const LOCALE_COOKIE = 'ORBIT_LOCALE'

/** One year — the user's language choice must persist. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365