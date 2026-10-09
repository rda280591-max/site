import { createServerClient } from '@supabase/ssr'
import createIntlMiddleware from 'next-intl/middleware'
import { NextResponse, NextRequest } from 'next/server'
import { hasLocale } from 'next-intl'
import { routing, type AppLocale } from '@/i18n/routing'
import { LOCALE_COOKIE } from '@/i18n/localeCookie'
import { createRateLimiter, ipKey } from '@/core/rateLimit'
import { isAiAgent } from '@/core/aiAgents'

// SECURITY (فاز ۲): کندکردن flood روی مسیرهای احراز هویت. مقصد نهایی (supabase-js +
// Google) خودش throttle دارد؛ این لایه فقط هزینه attempt را در edge کم می‌کند.
// پنجره باز: 30 درخواست/دقیقه به ازای هر IP — کاربر عادی هرگز به آن نمی‌رسد.
const authLimiter = createRateLimiter(30, 60)

// AGENTIC BROWSING (فاز ۴): بودژه جداگانه و بالاتر برای ایجنت‌های AI معتبر.
// NOTE: throttle فقط روی مسیر auth است (که محتوای crawl‌شدنی ندارد)؛ پس کرالر
// قانونی هرگز 429 روی صفحات عمومی نمی‌گیرد. اینجا فقط از flood عمدی/باگ‌دار به
// endpoint احراز هویت جلوگیری می‌شود، با سرعت مجاز ~4 برابر کاربر عادی.
const aiAuthLimiter = createRateLimiter(120, 60)

/**
 * Next.js 16: جایگزین middleware.ts → proxy.ts
 * (convention قبلی «middleware» منسوخ شده است)
 *
 * این فایل دو مسئولیت را به ترتیب و بدون تداخل انجام می‌دهد:
 *   1) مسیریابی زبان با next-intl (پیشوند /en یا /fa + ریدایرکت ریشه)
 *   2) رفرش توکن Supabase و نوشتن کوکی‌های نشست
 *
 * نکته‌ی کلیدی ترتیب: کوکی‌های نشست Supabase باید روی همان پاسخی ست شوند
 * که نهایتاً به مرورگر برمی‌گردد؛ پس ابتدا پاسخِ intl را می‌سازیم و بعد
 * کوکی‌ها را روی آن می‌نویسیم.
 */

const middlewaresByLocale: Record<AppLocale, ReturnType<typeof createIntlMiddleware>> = {
  en: createIntlMiddleware({ ...routing, defaultLocale: 'en' }),
  fa: createIntlMiddleware({ ...routing, defaultLocale: 'fa' }),
}

/**
 /* The locale this request should render with.
 *
 * نکته‌ی مهم درباره‌ی هدر: next-intl در سمت رندر (i18n/request.ts) زبانِ سگمنت
 * [locale] را نادیده می‌گیرد و به هدر X-NEXT-INTL-LOCALE اولویت می‌دهد.
 * پس این هدر باید دقیقاً همان زبانی باشد که خودِ پروکسی انتخاب کرده است:
 *   1) پیشوند صریح در آدرس → همان زبان (/login بدون پیشوند نیست → مرحله‌ی بعد)
 *   2) کوکی انتخاب کاربر   → ORBIT_LOCALE (اگر معتبر باشد)
 *   3) وگرنه              → زبان پیش‌فرض (en)
 *
 * اگر اینجا فقط کوکی را می‌خواندیم، درخواست بدون پیشوند و بدون کوکی با زبان
 * پیش‌فرض رندر می‌شد ولی پروکسی به /fa/... ریدایرکت می‌کرد و نتیجه یک
 * بارگذاری کامل اضافی (رفرش محسوس) بود.
 */
function localeForRequest(
  request: NextRequest,
  explicitLocale: AppLocale | undefined
): AppLocale {
  if (explicitLocale) return explicitLocale

  const chosen = request.cookies.get(LOCALE_COOKIE)?.value
  if (chosen && hasLocale(routing.locales, chosen)) return chosen

  return routing.defaultLocale
}

/**
 * درخواستی می‌سازد که زبانش از «انتخاب کاربر» می‌آید (نه Accept-Language).
 * الگوی رسمی next-intl برای locale سفارشی همین است.
 */
function requestWithChosenLocale(request: NextRequest, locale: AppLocale): NextRequest {
  const headers = new Headers(request.headers)
  headers.set('X-NEXT-INTL-LOCALE', locale)
  return new NextRequest(request.url, { headers })
}

/** Paths that must not receive a locale prefix. */
const BYPASS_PREFIXES = ['/auth', '/api', '/_next', '/_vercel']

// NOTE (تاریخی): توضیح قدیمی درباره «rewrite حذف پیشوند» دیگر دقیق نیست؛
// رفتار درست امروزی در بخش (1.6) با ریدایرکت صریح انجام می‌شود. تابع زیر
// فقط برای تشخیص مسیرهای ادمین نگه داشته شده است.
function isAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/')
}

/** Static files (images, fonts, manifest, ...) */
const STATIC_FILE = /\.[^/]+$/

function shouldBypass(pathname: string): boolean {
  if (BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true
  if (STATIC_FILE.test(pathname)) return true
  return false
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ---- (0) Throttle auth routes (login/callback/logout) ----
  if (
    pathname.startsWith('/auth') ||
    pathname === '/login' ||
    pathname === '/en/login' ||
    pathname === '/fa/login' ||
    pathname.includes('/%D8%B1%D9%88%D8%AF')
  ) {
    const ua = request.headers.get('user-agent')
    // Phase 4: legitimate AI agent -> higher budget (no security weakening; public pages
    // are never throttled, so crawling at legal speed never yields 429/403)
    const limiter = isAiAgent(ua) ? aiAuthLimiter : authLimiter
    const rl = limiter.check(ipKey(request))
    if (!rl.allowed) {
      return new NextResponse('Too Many Requests', {
        status: 429,
        headers: { 'Retry-After': String(rl.retryAfterSeconds), 'Cache-Control': 'no-store' },
      })
    }
  }

  // ---- (1) Excluded routes: session refresh only, no path rewriting ----
  if (shouldBypass(pathname)) {
    return refreshSession(request, NextResponse.next({ request }))
  }

  // ---- (1.5) پنل ادمین: /admin* بیرون از [locale] است و باید بدون rewrite
  // زبان سرو شود. اگر next-intl این مسیرها را بگیرد، داخل [locale] resolve‌شان
  // کرده و notFound() می‌دهد → همان 404 پنل ادمین روی Vercel.
  // NOTE: فقط pathname بررسی می‌شود؛ searchParams (/admin?x=...) در rewrite
  // حفظ می‌شوند. گارد سروری adminGuard بدون تغییر اعمال می‌گردد.
  // FIX (پنل ادمین دوزبانه): زبان پنل = کوکی ORBIT_LOCALE (سوییچر پنل آن را
  // می‌نویسد). دو هدر request به render می‌رسند: X-Admin-Locale (تصمیم نهایی)
  // و X-Admin-URL (برای پارامتر اضطراری ?locale= که سوییچر هم‌زمان ست می‌کند).
  if (isAdminPath(pathname)) {
    const res = NextResponse.next({ request });
    const chosen = request.cookies.get(LOCALE_COOKIE)?.value;
    if (chosen && hasLocale(routing.locales, chosen)) {
      res.headers.set('x-admin-locale', chosen);
      // FIX (باگ «رفرش=فارسی، ناوبری=انگلیسی»): next-intl در سمت رندر زبان را
      // از هدر X-NEXT-INTL-LOCALE می‌خواند (RequestLocale.js → HEADER_LOCALE_NAME).
      // این هدر فقط در مسیرهای عادی middleware ست می‌شد و پنل ادمین (branch 1.5)
      // از آن رد می‌شد؛ نتیجه: هر سِگمنت مستقلِ /admin/* (pageها، route handlerها)
      // که قبل از applyAdminPageLocale/resolveAdminLocale به getLocale()/getTranslations()
      // دسترسی پیدا کند، defaultLocale ('en') می‌گیرد — یعنی عنوان RSC هدر
      // «Manage News» انگلیسی می‌ماند در حالی که Provider/messages کوکی را دارند.
      // با ست کردن همین هدر روی درخواست ادمین، منبع حقیقت در کل لایه‌ها یکی می‌شود.
      res.headers.set('X-NEXT-INTL-LOCALE', chosen);
    }
    res.headers.set('x-admin-url', request.nextUrl.search || '');
    return refreshSession(request, res)
  }

  // ---- (1.6) سازگاری لینک‌های قدیمی /{locale}/admin* → /admin* ----
  // ریدایرکت داخل [locale] در Next 16 + Turbopack با notFound() سراسری
  // تداخل می‌کرد و خودِ /en/admin را 404 می‌داد. اینجا قبل از ورود به
  // next-intl، پیشوند زبان مسیر ادمین حذف می‌شود تا route واقعی بیرون
  // از [locale] سرو شود. کوئری‌استرینگ حفظ می‌گردد.
  {
    const m = pathname.match(/^\/(?:en|fa)(\/admin(?:\/.*)?)$/)
    if (m) {
      const url = request.nextUrl.clone()
      url.pathname = m[1]
      return refreshSession(request, NextResponse.redirect(url))
    }
  }

  // ---- (1.7) SECURITY FIX — حذف accessHelpResponse: نسخه قبلی در لبه یک
  // HTML کامل با ایمیل ادمین، URL پروژه Supabase و دستورات SQL آماده برمی‌گرداند
  // که برای هر بازدیدکننده ناشناس قابل خواندن بود (افشای اطلاعات حساس + ابزار
  // هدف‌گیری). حالا این مسیر هیچ مداخله‌ای نمی‌بیند و توسط خود صفحه
  // (/admin/access، route group بدون گارد) سرو می‌شود که فقط مقادیر بولین و
  // ایمیل mask شده نشان می‌دهد. تنها کاری که اینجا لازم است، رفرش نشست روی
  // پاسخ عادی است.

  // ---- (2) Current-path locale (if the URL explicitly has a prefix) ----
  const decodedPathname = decodeURIComponent(pathname)
  const explicitLocale = routing.locales.find(
    (locale) =>
      decodedPathname === `/${locale}` || decodedPathname.startsWith(`/${locale}/`)
  )

  // ---- (3) مسیریابی زبان ----
  // intlMiddleware ریدایرکت ریشه، rewrite و کارهای زبان را انجام می‌دهد؛ زبان را
  // با هدر X-NEXT-INTL-LOCALE قطعی می‌کنیم تا سمت رندر هم همان را ببیند.
  // نوع پاسخش همیشه NextResponse است، پس کوکی‌های نشست Supabase را روی همان
  // می‌نویسیم — چه ریدایرکت باشد چه نه.
  const targetLocale = localeForRequest(request, explicitLocale)
  const middleware = middlewaresByLocale[targetLocale] ?? middlewaresByLocale.en
  const intlResponse = middleware(
    requestWithChosenLocale(request, targetLocale)
  )

  return refreshSession(request, intlResponse)
}

/**
 * ساخت کلاینت سروری Supabase و رفرش توکن کاربر.
 * کوکی‌های تازه روی «پاسخ داده‌شده» ست می‌شوند تا به مرورگر برسند.
 */
async function refreshSession(request: NextRequest, response: NextResponse) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return response
  }

  // PERF (root cause of slow TTFB): بدون کوکی نشست، هیچ رفرشی لازم نیست.
  // قبلاً هر درخواست ناشناس یک رفت‌وبرگشت کامل به سرور Auth Supabase می‌رفت که
  // زمان پاسخ کل سایت (مخصوصاً موبایل) را بالا می‌برد. حالا فقط کاربران
  // واقعاً لاگین‌شده این مسیر را طی می‌کنند.
  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith('sb-') && c.name.includes('auth-token'))
  if (!hasAuthCookie) {
    return response
  }

  // مسیر callback را رد کن تا با تبادل کد (exchangeCodeForSession) تداخل نکند.
  if (request.nextUrl.pathname.startsWith('/auth/callback')) {
    return response
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  try {
    await supabase.auth.getUser()
  } catch {
    // When Supabase is unavailable we just return the response and stop
    // chained redirects.
  }

  return response
}

export default proxy;

export const config = {
  matcher: [
    /*
     /* Match all paths except static files, images, etc.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
