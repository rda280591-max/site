'use client'

import { useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'
import { LOCALE_LABELS, getDirection, type AppLocale } from '@/i18n/routing'
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from '@/i18n/localeCookie'

type Variant = 'pill' | 'compact'

interface LocaleToggleProps {
  /** pill = two-state button (default) — compact = icon button for the header */
  variant?: Variant
  className?: string
}

/**
 /* ORBIT — language switch button (Persian <-> English)
 *
 /* Each click toggles between the two locales and preserves the current path.
 * - usePathname از createNavigation می‌آید، پس مسیر بدون پیشوند زبان برمی‌گردد
 *   و useRouter خودش پیشوند زبان جدید (و مسیر بومی‌شده) را می‌سازد.
 * - کوئری‌استرینگ مثل ?error=... دست‌نخورده منتقل می‌شود.
 * - زبان انتخابی در کوکی ORBIT_LOCALE ذخیره می‌شود تا دفعه‌ی بعد
 *   (حتی در بازدید تازه یا مسیر /) همان زبان بیاید. حالت پیش‌فرض بدون کوکی: en.
 */
export function LocaleToggle({ variant = 'pill', className }: LocaleToggleProps) {
  const t = useTranslations('common')
  const locale = useLocale() as AppLocale
  const pathname = usePathname()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // زبان مقصدِ کلیک بعدی — برای همین هم «فارسی» و هم «English» روی دکمه دیده می‌شود،
  // بدون اینکه به هم ریختن DOM هنگام هیدریشن مشکلی بسازد.
  const [nextLocale, setNextLocale] = useState<AppLocale | null>(null)
  const other: AppLocale = locale === 'en' ? 'fa' : 'en'
  const preview: AppLocale = nextLocale ?? other

  const prefetchOtherLocale = () => {
    try {
      router.prefetch(pathname, { locale: other })
    } catch {}
  }

  const toggle = () => {
    if (isPending) return

    setNextLocale(other)

    try {
      document.cookie = `${LOCALE_COOKIE}=${other}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`
    } catch {
      // If the cookie cannot be written, switch the locale immediately.
    }

    startTransition(() => {
      router.replace(pathname, { locale: other })
    })
  }

  const isFaNext = preview === 'fa'
  const label = isFaNext ? LOCALE_LABELS.fa.native : LOCALE_LABELS.en.native
  const title = isFaNext ? 'Switch to English' : 'تغییر به فارسی'

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={toggle}
        onMouseEnter={prefetchOtherLocale}
        onTouchStart={prefetchOtherLocale}
        onFocus={prefetchOtherLocale}
        disabled={isPending}
        title={title}
        aria-label={`${t('switchLanguage')}: ${label}`}
        lang={preview}
        dir={getDirection(preview)}
        className={[
          'h-10 min-w-11 px-2.5 inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5',
          'transition-[background-color,border-color,transform] duration-200 hover:bg-white/10 hover:border-violet-500/30 active:scale-95',
          'disabled:cursor-wait',
          className ?? '',
        ].join(' ')}
        style={{ color: 'var(--orbit-text)' }}
      >
        <span className="text-base leading-none" aria-hidden>
          {LOCALE_LABELS[preview].flag}
        </span>
        <span className="hidden sm:inline text-xs font-bold">{label}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggle}
      onMouseEnter={prefetchOtherLocale}
      onTouchStart={prefetchOtherLocale}
      onFocus={prefetchOtherLocale}
      disabled={isPending}
      title={title}
      aria-label={`${t('switchLanguage')}: ${label}`}
      lang={preview}
      dir={getDirection(preview)}
      className={[
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold',
        'transition-[filter,transform] duration-200 hover:brightness-110 active:scale-95 disabled:cursor-wait',
        className ?? '',
      ].join(' ')}
      style={{
        borderColor: 'var(--orbit-border)',
        background: 'rgba(255,255,255,0.04)',
        color: 'var(--orbit-text)',
      }}
    >
      <span className="text-sm leading-none" aria-hidden>
        {LOCALE_LABELS[preview].flag}
      </span>
      <span>{label}</span>
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className={isPending ? 'animate-pulse' : ''}
        style={{ color: 'var(--orbit-text-muted)' }}
      >
        <path d="M8 7h12M8 7l-3 3M8 7 5 4" />
        <path d="M16 17H4M16 17l3-3M16 17l3 3" />
      </svg>
    </button>
  )
}

export default LocaleToggle