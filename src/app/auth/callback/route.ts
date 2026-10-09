import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { verifyOAuthStateCookie, clearOAuthStateCookie } from '@/services/auth/oauthPkce'

/**
 * مسیر بازگشت را امن می‌کند: فقط مسیرهای نسبی داخلی مجازند
 * تا از وابستگی باز (open redirect) جلوگیری شود.
 */
function safeNext(next: string | null, locale: string): string {
  if (!next) return '/'

  let candidate = next.trim()
  for (let i = 0; i < 3; i++) {
    if (!candidate) return '/'
    try {
      const decoded = decodeURIComponent(candidate)
      if (decoded === candidate) break
      candidate = decoded
    } catch {
      break
    }
  }

  if (
    candidate === '/login' ||
    candidate === '/en/login' ||
    candidate === '/fa/login' ||
    candidate === '/ورود' ||
    candidate === '/fa/ورود' ||
    candidate === '/en' ||
    candidate === '/fa'
  ) {
    return `/${locale}`
  }

  // FIX (open-redirect hardening): besides the leading "//" and "/\" forms,
  // reject ANY backslash anywhere in the path — some browsers normalize
  // "/.\evil.com" or "/\evil.com" into host-relative URLs.
  if (candidate.includes('\\')) {
    return '/'
  }

  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.startsWith('/\\')) {
    return '/'
  }

  return candidate
}

/**
 /* Read the return locale from the user-choice cookie so error paths stay localized.
 */
function currentLocale(cookieStore: { get(name: string): { value: string } | undefined }): string {
  const value = cookieStore.get('ORBIT_LOCALE')?.value
  return value === 'fa' ? 'fa' : 'en'
}

/**
 * پیام‌های خطای داخلی → کلید ترجمه برای صفحه ورود (نقشه در Page.client).
 * SECURITY: هرگز متن خام Supabase/GoTrue به URL برگردانده نمی‌شود؛ فقط این
 * برچسب‌های ثابت. صفحه ورود آن‌ها را با messages/{en,fa}.json ترجمه می‌کند.
 */
const GENERIC_SIGNIN_FAIL = 'signin_failed'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  // FIX (lint): error_description هرگز استفاده نمی‌شد؛ عمداً نادیده گرفته می‌شود
  // تا متن خام گوگل به کاربر افشا نشود — فقط کد خطای استاندارد منتقل می‌گردد.

  // استخراج دقیق origin بر مبنای هدرهای درخواست.
  // در Vercel، x-forwarded-host می‌تواند لیستی از هاست‌ها باشد
  // ("a.vercel.app, b.vercel.app") — باید فقط اولین (خارجی‌ترین) را برداریم،
  // وگرنه آدرس ریدایرکت خراب شده و کاربر پشت صفحه لاگین گیر می‌کند.
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const hostHeader = forwardedHost || request.headers.get('host') || requestUrl.host
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https'
  const cleanHost = hostHeader.replace(/^0\.0\.0\.0(?::|$)/, 'localhost$1')
  const origin = `${proto}://${cleanHost}`

  const cookieStore = await cookies()
  const locale = currentLocale(cookieStore)
  // مسیر لاگین باید از pathnames زبان‌بندِ routing ساخته شود (/fa/ورود، /en/login).
  // قبلاً دستی `/fa/ورود` و `/en/login` نوشته می‌شد؛ اگر route فیزیکی صفحه
  // login با آن pathname تطبیق نکند، ریدایرکت خطا به 404 می‌افتد.
  const loginPath = locale === 'fa' ? `/${locale}/%D8%B1%D9%88%D8%AF` : `/${locale}/login`
  const next = safeNext(requestUrl.searchParams.get('next'), locale)

  if (error || !code) {
    // کوکی state باید در هر شاخه خطا هم بسوزد (single-use)؛ وگرنه یک تلاش
    // ناموفق، چک تلاش بعدی را با state قدیمی مقایسه می‌کند.
    // FIX (دوزبانه): پیام از کلید ثابت ترجمه می‌شود — قبلاً هاردکد فارسی بود.
    const errorCode = error === 'access_denied' ? 'cancelled' : GENERIC_SIGNIN_FAIL
    const failed = NextResponse.redirect(
      `${origin}${loginPath}?error=${encodeURIComponent(errorCode)}`
    )
    clearOAuthStateCookie(failed)
    return failed
  }

  // SECURITY (login CSRF): state برگشتی باید با کوکی flow مطابقت کند؛
  // عدم تطبیق = تلاش تزریق کد authorization متعلق به مهاجم.
  const incomingState = requestUrl.searchParams.get('state')
  if (!verifyOAuthStateCookie(cookieStore, incomingState)) {
    console.warn('[auth/callback] oauth state mismatch — possible login CSRF attempt')
    const denied = NextResponse.redirect(
      `${origin}${loginPath}?error=${encodeURIComponent(GENERIC_SIGNIN_FAIL)}`
    )
    clearOAuthStateCookie(denied)
    return denied
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[auth/callback] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY is missing on the server')
    return NextResponse.redirect(
      `${origin}${loginPath}?error=${encodeURIComponent('service_unavailable')}`
    )
  }

  const response = NextResponse.redirect(`${origin}${next}`)
  // state مصرف شد — کوکی flow در همین پاسخ پاک می‌شود (single-use)
  clearOAuthStateCookie(response)

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
          try {
            cookieStore.set(name, value, options)
          } catch {
            // no-op
          }
        })
      },
    },
  })

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    console.warn('[auth/callback] exchangeCodeForSession failed:', exchangeError.message)
    return NextResponse.redirect(
      `${origin}${loginPath}?error=${encodeURIComponent(GENERIC_SIGNIN_FAIL)}`
    )
  }

  return response
}