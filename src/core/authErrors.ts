/**
 * قرارداد مشترک پیام‌های خطای احراز هویت (سرور ↔ کلاینت).
 *
 * SECURITY: هرگز متن خام Supabase/GoTrue به کلاینت یا URL برگردانده نمی‌شود؛
 * فقط برچسب‌های ثابت زیر. صفحه ورود با useTranslations('login.errors') و
 * fallback روی 'generic' ترجمه می‌کند — پس افزودن کد جدید بدون کلید ترجمه،
 * صفحه را نمی‌شکند.
 */
export const AUTH_ERROR_CODES = [
  'cancelled',            // کاربر جریان OAuth را در گوگل لغو کرد (access_denied)
  'signin_failed',        // خطای عمومی callback (تبادل کد PKCE ناموفق)
  'service_unavailable',  // env سوپابیس روی سرور تنظیم نشده
  'invalid_credentials',  // ایمیل/رمز اشتباه (فرم مستقیم) — ضد user-enumeration
  'rate_limited',         // سقف تلاش ورود از /api/admin/login رد شده
  'invalid_body',         // بدنه درخواست فرم/JSON معتبر نیست
  'oauth',                // خطای سمت کلاینت هنگام شروع OAuth
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

/** تشخیص امن اینکه مقدار ?error= یک کد شناخته‌شده است (نه متن دلخواه مهاجم). */
export function isAuthErrorCode(v: string | null): v is AuthErrorCode {
  return !!v && (AUTH_ERROR_CODES as readonly string[]).includes(v);
}

/** نقشه پاسخ JSON اکشن → کد خطای استاندارد (برای فرم ورود). */
export function authErrorFromStatus(status: number): AuthErrorCode {
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'service_unavailable';
  return 'invalid_credentials';
}
