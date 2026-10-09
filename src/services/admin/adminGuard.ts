import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getAdminClient, type AdminSupabase } from './serverClient';
import { routing } from '@/i18n/routing';

export interface AdminContext {
  supabase: AdminSupabase;
  userId: string;
  email: string | null;
}

/**
 * FIX — «همه کارها را کردم ولی /admin باز هم 404 می‌دهد»:
 * گارد قبلاً برای کاربرِ لاگین‌شده ولی غیرادمین `notFound()` می‌داد؛ نتیجه یک
 * 404 بی‌سروصدا بود بدون اینکه معلوم شود کدام حلقه (env؟ نشست؟ نقش؟) خراب است.
 * حالا هر شکست به صفحه عیب‌یابی /admin/access با پارامتر علت ریدایرکت می‌شود.
 */
export type AdminDenyReason = 'no-session' | 'not-admin' | 'banned';

function accessUrl(reason: AdminDenyReason): string {
  return `/admin/access?why=${reason}`;
}

/**
 * FIX — حلقه ریدایرکت: صفحه عیب‌یابی /admin/access داخل همان layout ادمین
 * رندر می‌شد که requireAdmin صدا می‌زند؛ برای کاربر بن‌شده/بدون نشست مسیر
 * login → /admin → access → retry → /admin … قفل می‌شد. حالا آن صفحه اصلاً
 * داخل این layout نیست (route group جدا) و از همین تابع بدون-redirect
 * وضعیت را می‌خواند.
 */
export interface AdminAccessState {
  envOk: boolean;
  signedIn: boolean;
  email: string | null;
  role: string | null;
  status: string | null;
}

/** نسخه بدون redirect برای صفحه عمومی عیب‌یابی /admin/access. */
export async function inspectAdminAccess(): Promise<AdminAccessState> {
  const none: AdminAccessState = { envOk: false, signedIn: false, email: null, role: null, status: null };
  const supabase = await getAdminClient();
  if (!supabase) return none;
  try {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return { ...none, envOk: true };
    // ستون status ممکن است در اسکیمای دستی وجود نداشته باشد → fallback به role-only
    let p: { role: string; status: string | null } | null = null;
    const full = await supabase
      .from('profiles')
      .select('role,status')
      .eq('id', user.id)
      .maybeSingle<{ role: string; status: string }>();
    if (full.data) {
      p = { role: full.data.role, status: full.data.status ?? null };
    } else {
      const r = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle<{ role: string }>();
      p = r.data ? { role: r.data.role, status: null } : null;
    }
    return { envOk: true, signedIn: true, email: user.email ?? null, role: p?.role ?? null, status: p?.status ?? null };
  } catch {
    return { ...none, envOk: true };
  }
}

async function adminLoginUrl(): Promise<string> {
  let locale = 'en';
  try {
    const store = await cookies();
    if (store.get('ORBIT_LOCALE')?.value === 'fa') locale = 'fa';
  } catch {
    /* default en */
  }
  // pathname واقعی هر زبان از مپینگ مرکزی next-intl گرفته می‌شود (/en/login،
  // /fa/ورود)؛ ساخت دستی رشته‌ها با تغییر pathnames می‌شکست و حلقه ریدایرکت
  // ایجاد می‌کرد.
  const pathname = routing.pathnames['/login']![locale as 'en' | 'fa'];
  return `/${locale}${pathname}?next=${encodeURIComponent('/admin')}`;
}

/**
 * گارد چهار مرحله‌ای ادمین:
 *  0) نبود env Supabase روی سرور → ریدایرکت به ورود (قبلاً notFound بود که
 *     «500/404 بی‌دلیل» تولید می‌کرد). علت در Function logs ورژل لاگ می‌شود.
 *  1) getUser() — اعتبارسنجی واقعی توکن در Supabase Auth (نه فقط decode).
 *     نبود نشست → redirect به صفحه ورود با ?next=/admin.
 *  2) بررسی role='admin' و status='active' در جدول profiles. نبود پروفایل →
 *     خودترمیم با insert (trigger حذف‌شده جبران می‌شود). اگر جدول profiles
 *     اصلاً وجود ندارد (migration اجرا نشده) → لاگ DIAG و رفتار مهمان.
 *  3) non-admin → 404 (بدون افشای وجود پنل؛ جلوگیری از user enumeration).
 * FIX — «اینتر می‌زنم 404/خطای ناشناخته می‌گیرد»: هر شاخه‌ای که قبلاً با
 * notFound()/throw خام بی‌سروصدا شکست می‌شد، حالا یا مسیر واضح دارد یا در
 * console لاگ تشخیصی می‌زند (Vercel → Project → Observability → Logs).
 */
export async function requireAdmin(): Promise<AdminContext> {
  const supabase = await getAdminClient();
  if (!supabase) {
    // FIX — حلقه ریدایرکت env ناقص: قبلاً به login می‌رفت، ورود موفق برمی‌گشت
    // به /admin و دوباره همین شاخه → چرخه بی‌پایان login→admin→login. حالا
    // مستقیم به صفحه عیب‌یابی (بدون گارد) با علت why=no-env می‌رود؛ آن صفحه
    // در route group جداست و هرگز requireAdmin صدا نمی‌زند → حلقه ممکن نیست.
    console.error('[adminGuard] Supabase env missing on server — routing to /admin/access');
    redirect('/admin/access?why=no-env');
  }

  // FIX (پایداری): خطای شبکه/دیتابیس در getUser نباید صفحه را با stack خام
  // منفجر کند؛ مثل بقیه لایه‌ها، خطا → ریدایرکت به ورود.
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    user = null;
  }

  if (!user) {
    // کاربر لاگین نکرده: به صفحه ورود همان زبان هدایت شود و بعد از ورود
    // مستقیم به /admin برگردد (safeNext در callback مسیر نسبی را می‌پذیرد).
    redirect(await adminLoginUrl());
  }

  let profile: { role: string; status: string | null } | null = null;
  try {
    // FIX — ستون status در اسکیمای دستی بعضی پروژه‌ها وجود ندارد؛ انتخاب
    // صریح آن باعث 400 و «پروفایل=null → not-admin» می‌شد. حالا اول با
    // role فقط خوانده می‌شود و status به‌صورت best-effort اضافه می‌گردد.
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle<{ role: string }>();
    if (error) {
      console.error('[adminGuard] profiles read failed:', error.code, error.message);
    }
    if (data) {
      let status: string | null = null;
      try {
        const s = await supabase
          .from('profiles')
          .select('status')
          .eq('id', user.id)
          .maybeSingle<{ status: string }>();
        status = s.data?.status ?? null;
      } catch {
        /* column missing — treat as active */
      }
      profile = { role: data.role, status };
    }

    // پروفایلِ نبود (کاربران ثبت‌نام‌شده قبل از ساخت جدول profiles یا حذف
    // trigger همگام‌سازی) → خودترمیم: ساخت ردیف با مقادیر پیش‌فرض.
    if (!profile) {
      const { data: created, error: insErr } = await supabase
        .from('profiles')
        .insert({ id: user.id, email: user.email ?? null })
        .select('role')
        .maybeSingle<{ role: string }>();
      if (insErr) {
        console.error('[adminGuard] profile self-heal insert failed:', insErr.code, insErr.message);
      }
      profile = created ? { role: created.role, status: null } : null;
    }
  } catch (e) {
    console.error('[adminGuard] unexpected profiles query failure:', e);
    profile = null;
  }

  const isAdmin = profile?.role === 'admin';
  const isBanned = profile?.status === 'banned'; // نبود ستون status → null → رد نشود

  if (!isAdmin || isBanned) {
    // DIAG — دقیقاً چرا دسترسی رد شد (نقش؟ وضعیت؟ نبود ردیف؟) در لاگ ثبت شود.
    // FIX (PII): ایمیل کامل در لاگ ورژل نوشته نمی‌شود؛ فقط شکل mask شده
    // (a***@domain) که برای تشخیص کافی است و قابل بازیابی نیست.
    const email = user.email ?? '';
    const maskedEmail = email ? `${email[0]}***@${email.split('@')[1] ?? '?'}` : null;
    console.warn(
      '[adminGuard] access denied for',
      JSON.stringify({ email: maskedEmail, role: profile?.role ?? null, status: profile?.status ?? null }),
    );
    // FIX — دیگر 404 خام نیست؛ به صفحه راهنمای دسترسی با علت دقیق می‌رود تا
    // کاربر بداند کدام مرحله (لاگین/نقش/migration) گیر کرده است.
    redirect(accessUrl(isBanned ? 'banned' : 'not-admin'));
  }

  return { supabase, userId: user.id, email: user.email ?? null };
}
