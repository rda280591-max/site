import { cache } from 'react';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export type AdminSupabase = NonNullable<Awaited<ReturnType<typeof getAdminClient>>>;

/**
 * ساخت کلاینت Supabase سمت سرور با کوکی‌های نشست واقعی.
 * عمداً lazy import می‌شود تا @supabase/ssr وارد باندل صفحات عمومی نگردد.
 */
export const getAdminClient = cache(async () => {
  // FIX — پشتیبانی از کلیدهای جدید Supabase (sb_publishable_.../sb_secret_...)
  // که در داشبورد جایگزین anon key شده‌اند؛ اگر env قدیمی ست نشده باشد، از
  // متغیرهای معادل fallback می‌شود تا گارد ادمین بی‌دلیل به login نیفتد.
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_PROJECT_URL ||
    '';
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    '';
  if (!url || !anonKey) {
    // DIAG — نبود env روی Vercel دقیقاً همان باگ «/admin بدون هیچ پیامی به首页
    // برمی‌گردد» را تولید می‌کرد (getAdminClient → null → notFound/redirect).
    // این لاگ در Function logs ورژل، علت را یک‌خطی نشان می‌دهد.
    console.error(
      '[adminGuard] Supabase env missing on server:',
      JSON.stringify({
        url: url ? 'set' : 'MISSING',
        anonKey: anonKey ? 'set' : 'MISSING',
      }),
    );
    return null;
  }

  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      // در RSC خواندنی هستیم؛ نوشتن فقط در Server Action/Route Handler انجام می‌شود.
      setAll: () => {},
    },
  });
});
