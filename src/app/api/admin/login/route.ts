import { type NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createRateLimiter, ipKey } from '@/core/rateLimit';

/**
 * POST /api/admin/login — ورود با ایمیل/رمز عبور (مخصوص پنل ادمین).
 *
 * چرا این endpoint وجود دارد (کاربری «PRO»):
 *  - ورود فعلی فقط Google OAuth است؛ برای ورود به پنل در حالت offline،
 *    بدون دامنه پیکربندی‌شده برای redirect، یا روی IP مستقیم، کاربر گیر می‌کند.
 *  - Supabase Email/Password یک provider داخلی است و کلید publishable برای
 *    آن کافیست؛ نیاز به تنظیمات اضافه در dashboard نیست (فقط فعال بودن
 *    Provider «Email» که در همه پروژه‌ها پیش‌فرض روشن است).
 *
 * SECURITY:
 *  - احراز هویت سمت سرور انجام می‌شود؛ کوکی‌های نشست sb-* با setAll روی
 *    پاسخ نوشته می‌شوند (همان الگوی logout/callback) و هرگز توکنی به
 *    کلاینت برگردانده نمی‌شود.
 *  - Rate Limit سفت‌تر از بقیه مسیرها: 8 تلاش/۱۰ دقیقه به‌ازای IP — چون
 *    رمز عبور هدف brute-force است. (proxy لایه اول را روی /login می‌زند؛
 *    این لایه دوم مخصوص همین endpoint است.)
 *  - محافظت CSRF: درخواست باید same-origin باشد (Origin == host خود سرویس).
 *  - پیام خطا general است (invalid_credentials) تا user enumeration نشود؛
 *    جزئیات واقعی فقط در server log لاگ می‌شود.
 */
export const dynamic = 'force-dynamic';

// FIX (brute-force): کلید قبلی فقط IP بود. پشت CDN/شرکت‌های بزرگ، مهاجم می‌تواند
// همه تلاش‌ها را از یک IP مشترکِ هزاران کاربر قانونی بزند و آن‌ها را قفل کند
// (lockout انکار سرویس) — یا برعکس، با چرخاندن IP سقف هر IP را دور بزند. حالا
// کلید ترکیبی (IP + ایمیل نرمال‌شده) است: سقف هم‌زمان «به‌ازای هر IP» و
// «به‌ازای هر حساب» اعمال می‌شود و قفل‌شدن یک حساب، بقیه کاربران آن IP را
// فلج نمی‌کند.
const loginIpLimiter = createRateLimiter(20, 600); // 20 attempt-IP / 10 min (پراکنده)
const loginAccountLimiter = createRateLimiter(5, 900); // 5 attempt / 15 min / email

/** استخراج host بیرونی (پشت Vercel، x-forwarded-host لیستی است → اولین مورد). */
function requestOrigin(req: NextRequest): string {
  const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || req.headers.get('host') || req.nextUrl.host;
  const proto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https';
  return `${proto}://${host}`;
}

/** اعتبارسنجی شکل URL قبل از استفاده (جلوگیری از env آلوده/بدون پروتکل). */
function isHttpUrl(u: string): boolean {
  try {
    const p = new URL(u);
    return p.protocol === 'https:' || p.protocol === 'http:';
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ---- CSRF: Origin باید با host خود سرویس یکی باشد (در نبود Origin، curl/سرور مجاز) ----
  const origin = req.headers.get('origin');
  if (origin) {
    let ok = false;
    try {
      ok = new URL(origin).host === new URL(requestOrigin(req)).host;
    } catch {
      ok = false;
    }
    if (!ok) return NextResponse.json({ ok: false, error: 'forbidden_origin' }, { status: 403 });
  }

  // ---- Rate limit (سخت‌گیرانه‌ترین limiter پروژه — هدف brute-force) ----
  // FIX: سقف IP اینجا فقط «شکل درخواست» را محدود می‌کند؛ سقف هر-حساب بعد از
  // استخراج ایمیل اعمال می‌شود (تا مهاجم با راندوم‌کردن ایمیل، قفل حساب هدف
  // را دور نزند و کاربر قانونی پشت IP اشتراکی هم بی‌دلیل قفل نشود).
  if (!loginIpLimiter.check(ipKey(req.headers)).allowed) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
  }

  // ---- بدنه: فقط فیلدهای سفیدشده، سقف حجم کوچک ----
  let email = '';
  let password = '';
  try {
    const ct = req.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) {
      const raw = await req.text();
      if (raw.length > 4096) throw new Error('body too large');
      const j = JSON.parse(raw) as Record<string, unknown>;
      email = typeof j.email === 'string' ? j.email.trim().toLowerCase() : '';
      password = typeof j.password === 'string' ? j.password : '';
    } else {
      const form = await req.formData();
      email = String(form.get('email') ?? '').trim().toLowerCase();
      password = String(form.get('password') ?? '');
    }
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ ok: false, error: 'invalid_credentials' }, { status: 401 });
  }
  // FIX (brute-force): سقف هر-حساب — بعد از استخراج و نرمال‌سازی ایمیل اعمال
  // می‌شود تا مهاجم با چرخاندن IP، قفل حساب هدف را دور نزند.
  if (!loginAccountLimiter.check(`acct:${email}`).allowed) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
  }
  if (password.length < 1 || password.length > 72) {
    // 72 = سقف bcrypt؛ طول بیشتر قطعاً رمز درست نیست (و از crash جلوگیری می‌کند)
    return NextResponse.json({ ok: false, error: 'invalid_credentials' }, { status: 401 });
  }

  // ---- env (با fallback معادل serverClient تا گارد بی‌دلیل نیفتد) ----
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
  if (!url || !anonKey || !isHttpUrl(url)) {
    console.error('[admin/login] Supabase env missing/invalid on server');
    return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 503 });
  }

  const store = await cookies();
  const response = NextResponse.json({ ok: true });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
        for (const { name, value, options } of list) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // DIAG: علت واقعی فقط در لاگ سرور (Vercel → Function logs)؛ نه به کلاینت.
    console.warn('[admin/login] failed:', error.message);
    return NextResponse.json({ ok: false, error: 'invalid_credentials' }, { status: 401 });
  }

  // موفق — کوکی‌های نشست روی پاسخ ست شده‌اند؛ نقش/status را adminGuard
  // در رندر بعدی (/admin) چک می‌کند (non-admin → 404، بدون افشای وجود پنل).
  return response;
}
