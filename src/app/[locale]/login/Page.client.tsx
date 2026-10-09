'use client'

import React, { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { getSupabaseClient } from '@/services/auth/lazySupabase'
import { beginOAuthFlow } from '@/services/auth/oauthPkce'
import { BRAND } from '@/core/config'
import { isAuthErrorCode, type AuthErrorCode } from '@/core/authErrors'
import { LocaleToggle } from '@/ui/components/molecules/LocaleToggle'
import PasswordLoginForm from '@/ui/components/molecules/PasswordLoginForm'

/** مسیر مقصد پس از ورود را امن استخراج می‌کند (فقط نسبی داخلی). */
function readNextParam(): string | null {
  if (typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get('next')
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null
  return raw
}

function LoginPage() {
  const t = useTranslations('login')
  const tErr = useTranslations('login.errors')
  const tBrand = useTranslations('brand')
  const [loading, setLoading] = useState(false)
  // FIX (بازدید/امنیت): ?error= فقط کدهای شناخته‌شده احراز هویت را می‌پذیرد و
  // با fallback روی generic ترجمه می‌شود؛ قبلاً متن خام decodeURIComponent
  // مستقیم رندر می‌شد (کلید نامعتبر → رشته خام به کاربر، و هر مقدار دلخواه
  // مهاجم در URL بدون تأیید نمایش داده می‌شد).
  const [urlErrorKey] = useState<AuthErrorCode | 'generic' | null>(() => {
    if (typeof window === 'undefined') return null
    const err = new URLSearchParams(window.location.search).get('error')
    if (!err) return null
    return isAuthErrorCode(err) ? err : 'generic'
  })
  // FIX (تایپ): کلید از پیش اعتبارسنجی شده و همه مقادیر ممکن در login.errors
  // وجود دارند → فراخوانی مستقیم بدون cast.
  const urlErrorText = urlErrorKey ? tErr(urlErrorKey) : null
  // خطای لحظه‌ای (از جریان OAuth کلاینت) در اولویت نسبت به خطای URL است.
  const [liveError, setLiveError] = useState<string | null>(null)
  const error = liveError ?? urlErrorText
  const setError = setLiveError

  const handleGoogleLogin = async () => {
    if (loading) return
    setError(null)
    setLoading(true)

    const locale = (() => {
      if (typeof window === 'undefined') return 'en'

      const match = window.location.pathname.match(/^\/(en|fa)(?:\/|$)/)
      return match ? match[1] : 'en'
    })()

    // اگر از /admin به اینجا فرود آمده باشیم (?next=/admin)، بعد از ورود
    // باید مستقیم به همان مقصد برگردیم — نه صفحهٔ اصلی. safeNext در callback
    // فقط مسیرهای نسبی داخلی را می‌پذیرد، پس عبور آن بی‌خطر است.
    // FIX (ماژولار): استخراج next به تابع readNextParam منتقل شد (یکجا).
    const destination = readNextParam() ?? `/${locale}`

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    // اگر env تعریف نشده باشد createBrowserClient با undefined می‌ترکد
    // (خطای "URL must be defined" سمت کلاینت). اینجا کنترل می‌کنیم و پیام
    // کاربرپسند نشان می‌دهیم، نه کرش.
    if (!supabaseUrl || !supabaseAnonKey) {
      setError(tErr('oauth'))
      setLoading(false)
      return
    }

    try {
      // lazy: سوپابیس فقط همین‌جا (لحظه کلیک روی ورود) لود می‌شود
      const supabase = await getSupabaseClient()
      if (!supabase) {
        setError(tErr('oauth'))
        setLoading(false)
        return
      }
      // SECURITY: anti-CSRF state + flowType=pkce (standard entropy)
      const oauthState = beginOAuthFlow()
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(destination)}&state=${encodeURIComponent(oauthState)}`,
          queryParams: { prompt: 'select_account', state: oauthState },
        },
      })

      if (oauthError) {
        setError(tErr('oauth'))
        setLoading(false)
      }
    } catch {
      setError(tErr('oauth'))
      setLoading(false)
    }
    // On success the browser redirects to Google; no need to clear loading.
  }

  const features = [
    { title: t('hero.feature1Title'), desc: t('hero.feature1Desc') },
    { title: t('hero.feature2Title'), desc: t('hero.feature2Desc') },
    { title: t('hero.feature3Title'), desc: t('hero.feature3Desc') },
  ]

  return (
    <main
      className="relative min-h-[100dvh] w-full overflow-hidden lg:grid lg:grid-cols-2"
      style={{ background: 'var(--orbit-bg)' }}
    >
      {/* ---------- پنل گرافیکی (فقط دسکتاپ) ---------- */}
      <aside
        className="relative hidden lg:flex flex-col justify-between overflow-hidden p-10 xl:p-14"
        style={{
          background:
            'radial-gradient(circle at 30% 20%, rgba(124,58,237,0.35), transparent 55%), radial-gradient(circle at 70% 80%, rgba(6,182,212,0.28), transparent 55%), var(--orbit-bg-elevated)',
        }}
      >
        {/* شبکه‌ی ظریف پس‌زمینه */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
            maskImage: 'radial-gradient(circle at 50% 40%, black, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(circle at 50% 40%, black, transparent 75%)',
          }}
        />

        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BrandMark size={44} />
            <div>
              <div className="text-lg font-black tracking-widest">{BRAND.name}</div>
              <div className="text-xs" style={{ color: 'var(--orbit-text-muted)' }}>
                {t('hero.eyebrow')}
              </div>
            </div>
          </div>
          <LocaleToggle />
        </div>

        <div className="relative max-w-md">
          <h1 className="text-4xl xl:text-5xl font-black leading-[1.25] tracking-tight">
            <span className="bg-gradient-to-l from-violet-300 via-white to-cyan-300 bg-clip-text text-transparent">
              {t('hero.titleLine1')}
            </span>
            <br />
            {t('hero.titleLine2')}
          </h1>
          <p className="mt-5 text-base leading-8" style={{ color: 'var(--orbit-text-secondary)' }}>
            {t('hero.subtitle', { tagline: tBrand('tagline') })}
          </p>

          <ul className="mt-8 space-y-4">
            {features.map((f) => (
              <li key={f.title} className="flex items-start gap-3">
                <span
                  className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white"
                  style={{
                    background: 'linear-gradient(135deg, #7C3AED, #06B6D4)',
                    boxShadow: '0 4px 14px rgba(124,58,237,0.35)',
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 12 5 5L20 7" />
                  </svg>
                </span>
                <div>
                  <div className="text-sm font-bold">{f.title}</div>
                  <div className="text-xs" style={{ color: 'var(--orbit-text-muted)' }}>
                    {f.desc}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs" style={{ color: 'var(--orbit-text-muted)' }}>
          {t('hero.copyright', { year: new Date().getFullYear(), brand: BRAND.name })}
        </p>
      </aside>

      {/* ---------- ستون فرم ---------- */}
      <section
        className="relative flex min-h-[100dvh] flex-col items-center justify-center px-5 py-8 sm:px-6 lg:min-h-screen lg:py-12"
        style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
      >
        {/* هاله‌ی رنگی ملایم فقط در موبایل */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-64 lg:hidden"
          style={{ background: 'radial-gradient(circle at 50% 0%, rgba(124,58,237,0.22), transparent 70%)' }}
        />

        <div className="relative w-full max-w-md">
          <div className="mb-7 flex flex-col items-center text-center lg:mb-8">
            <BrandMark size={56} />
            <h1 className="mt-4 text-2xl font-black tracking-widest">{BRAND.name}</h1>
            <p className="mt-1.5 text-sm" style={{ color: 'var(--orbit-text-muted)' }}>
              {t('form.heading')}
            </p>
          </div>

          <div className="orbit-glass rounded-3xl p-5 sm:p-7">
            {error && (
              <div
                role="alert"
                className="mb-4 flex items-start gap-2.5 rounded-2xl border p-3.5 text-sm"
                style={{
                  borderColor: 'rgba(239,68,68,0.35)',
                  background: 'rgba(239,68,68,0.1)',
                  color: '#FCA5A5',
                }}
              >
                <svg className="mt-0.5 shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
                <span className="leading-6">{error}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              aria-busy={loading}
              className="group flex w-full items-center justify-center gap-3 rounded-2xl border border-white/12 bg-white px-4 text-base font-bold text-slate-800 shadow-[0_8px_28px_rgba(0,0,0,0.28)] transition-[background-color,color,border-color,opacity] duration-200 select-none hover:shadow-[0_12px_36px_rgba(0,0,0,0.38)] hover:brightness-[1.02] active:scale-[0.98] active:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
              style={{ minHeight: 54, touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
            >
              {loading ? (
                <>
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
                  {t('form.redirecting')}
                </>
              ) : (
                <>
                  <GoogleIcon />
                  {t('form.googleButton')}
                </>
              )}
            </button>

            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1" style={{ background: 'var(--orbit-border)' }} />
              <span className="text-[11px]" style={{ color: 'var(--orbit-text-muted)' }}>
                {t('form.divider')}
              </span>
              <span className="h-px flex-1" style={{ background: 'var(--orbit-border)' }} />
            </div>

            {/* ورود با ایمیل/رمز — مکمل PRO برای حالت offline/بدون دامنه OAuth
                (POST /api/admin/login — احراز هویت سمت سرور، rate-limit 8/10min) */}
            <PasswordLoginForm next={readNextParam()} />

            <p className="text-center text-xs leading-6" style={{ color: 'var(--orbit-text-muted)' }}>
              {t('form.termsPrefix')}{' '}
              <span style={{ color: 'var(--orbit-text-secondary)' }}>{t('form.termsLink')}</span>{' '}
              {t('form.termsConjunction')}{' '}
              <span style={{ color: 'var(--orbit-text-secondary)' }}>{t('form.privacyLink')}</span>{' '}
              {t('form.termsSuffix')}
            </p>
          </div>

          <p className="mt-6 text-center text-xs" style={{ color: 'var(--orbit-text-muted)' }}>
            {t('form.footerQuestion')}{' '}
            <Link href="/" className="font-bold underline-offset-4 hover:underline" style={{ color: 'var(--orbit-secondary)' }}>
              {t('form.footerLink')}
            </Link>
          </p>
        </div>
      </section>
    </main>
  )
}

/** Brand logo — gradient square with the letter O */
function BrandMark({ size = 56 }: { size?: number }) {
  return (
    <div
      className="grid place-items-center rounded-2xl font-black text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.45,
        background: 'linear-gradient(135deg, #7C3AED, #06B6D4)',
        boxShadow: '0 10px 30px rgba(124,58,237,0.4)',
      }}
      aria-hidden
    >
      O
    </div>
  )
}

/** Official Google icon */
function GoogleIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  )
}

export default LoginPage;
