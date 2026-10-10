import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { invalidateAdminSessionCache } from '@/services/admin/adminGuard';

/**
 * POST /api/auth/logout — پایان نشست سمت سرور.
 * SECURITY: signOut فقط از طریق این مسیر server-side انجام می‌شود تا کوکی‌های
 * sb-* واقعاً پاک شوند (حذف لوکال استورِ کلاینت کافی نبود و توکن مرورگر تا
 * انقضا معتبر می‌ماند). نشستن با همان cookieهای درخواست شناسایی می‌شود.
 */
export const dynamic = 'force-dynamic';

export async function POST(): Promise<NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const store = await cookies();
  const response = NextResponse.json({ ok: true });

  // PERF/SEC — با لاگ‌اوت، کش اعتبارسنجی نشست ادمین (adminGuard) باید فوراً
  // بسوزد؛ در غیر این صورت تا TTL کوتاهش ممکن است فریم بعدی /admin را با
  // دسترسی قدیمی سرو کند. clear کامل چون اینجا userId در دسترس نیست و عملیات
  // نادر است.
  invalidateAdminSessionCache();

  if (!url || !anonKey) {
    // env نیست → حداقل کوکی‌ها را خودمان پاک کن تا کاربر از قفل بیرون بیاید.
    for (const c of store.getAll()) {
      if (c.name.startsWith('sb-')) response.cookies.delete(c.name);
    }
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        for (const { name, value, options } of list) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  try {
    await supabase.auth.signOut();
  } catch {
    /* خطای شبکه نباید لاگین مجدد را مسدود کند */
  }

  // اطمینان از پاک شدن کامل کوکی‌های نشست در پاسخ
  for (const c of store.getAll()) {
    if (c.name.startsWith('sb-')) response.cookies.delete(c.name);
  }

  return response;
}
