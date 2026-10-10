'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import Icon, { type IconName } from '@/ui/components/atoms/Icon';
import { lazyAuth } from '@/services/auth/lazySupabase';
import AdminLocaleToggle from './AdminLocaleToggle';
import type { AppLocale } from '@/i18n/routing';

type NavKey = 'dashboard' | 'news' | 'feeds' | 'audit' | 'users' | 'settings';

const LINKS: ReadonlyArray<{ href: string; key: NavKey; testid: string; icon: IconName }> = [
  { href: '/admin', key: 'dashboard', testid: 'admin-nav-dashboard', icon: 'chart' },
  { href: '/admin/news', key: 'news', testid: 'admin-nav-news', icon: 'note' },
  { href: '/admin/feeds', key: 'feeds', testid: 'admin-nav-feeds', icon: 'refresh' },
  { href: '/admin/audit', key: 'audit', testid: 'admin-nav-audit', icon: 'clock' },
  { href: '/admin/users', key: 'users', testid: 'admin-nav-users', icon: 'user' },
  { href: '/admin/settings', key: 'settings', testid: 'admin-nav-settings', icon: 'settings' },
] as const;

/**
 * ناوبری موبایل پنل ادمین (زیر md) — نوار پایین + منوی بازشو.
 *
 * FIX (UX موبایل): قبلاً سایدبار فقط `hidden md:flex` بود و روی موبایل **هیچ**
 * راهی برای جابه‌جایی بین تب‌ها یا سوییچ زبان وجود نداشت (کاربر در صفحه اول
 * گیر می‌کرد). حالا:
 *   - Bottom bar با safe-area (آیکون‌های لمسی ≥44px، هایلایت آیتم فعال)
 *   - دکمه «More» → منوی کاملِ slide-over: همه تب‌ها + سوییچ زبان + خروج
 *   - سرعت سوییچ: همان router.prefetch بک‌گراند (RSC payload آماده) تا کلیک
 *     تقریباً آنی رندر شود؛ بسته‌شدن منو قبل از ناوبری، فریم بعدی را قفل نمی‌کند
 * دسترس‌پذیری: role=dialog + aria-modal، بستن با Escape، بستن با کلیک روی
 * backdrop، focus-first-item هنگام باز شدن (بدون trap کامل تا JS سبک بماند).
 */
export default function AdminMobileNav({ email, locale }: { email: string | null; locale: AppLocale }) {
  const pathname = usePathname();
  const router = useRouter();
  const tp = useTranslations('admin.pages');
  const t = useTranslations('admin');
  // بستن خودکار منو وقتی مسیر عوض می‌شود (ناوبری از داخل منو).
  // FIX lint (react-hooks/set-state-in-effect): به‌جای setState در effect، از
  // الگوی رسمی React «reset state on prop change» استفاده می‌شود: کلیدِ state
  // خودِ pathname است؛ با تغییر مسیر، state جدید (بسته) بدون هیچ effect ساخته
  // می‌شود — یک رندر، صفر خطای lint.
  const [openKey, setOpen] = useState<{ key: string; open: boolean }>({ key: pathname, open: false });
  if (openKey.key !== pathname) {
    // حین رندر فقط وقتی pathname عوض شده reset می‌شود (الگوی مستند React)
    setOpen({ key: pathname, open: false });
  }
  const open = openKey.key === pathname && openKey.open;
  const setOpenState = useCallback((v: boolean) => {
    setOpen((s) => ({ key: s.key, open: v }));
  }, []);
  const firstItemRef = useRef<HTMLAnchorElement>(null);

  // Escape برای بستن + قفل اسکرول body هنگام باز بودن منو
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenState(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // فوکوس روی اولین آیتم منو (کمک به کیبورد/TalkBack)
    firstItemRef.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, setOpenState]);

  function isActive(href: string) {
    return href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
  }

  function warmPrefetch() {
    // گرم کردن RSC payload همه تب‌ها در idle time — کاربر موبایل معمولاً
    // بلافاصله بعد از ورود یک تب را انتخاب می‌کند؛ prefetch روی hover
    // (سایدبار دسکتاپ) اینجا معنا ندارد، پس یک‌بار کل مسیرها را می‌گیریم.
    if (typeof window === 'undefined') return;
    const go = () => LINKS.forEach((l) => { try { router.prefetch(l.href); } catch { /* best-effort */ } });
    if ('requestIdleCallback' in window) {
      (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void })
        .requestIdleCallback?.(go, { timeout: 3000 });
    } else {
      setTimeout(go, 2500);
    }
  }

  async function quickExit() {
    setOpenState(false);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      /* شبکه قطع باشد هم لاگین مجدد بی‌خطر است */
    }
    await lazyAuth.signOut();
    router.replace('/');
  }

  return (
    <>
      {/* ── نوار پایین موبایل ─────────────────────────────────────────── */}
      <nav
        className="admin-mbar fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-white/10 bg-[#0B0E17]/95 backdrop-blur-md md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label={t('navLabel')}
        data-testid="admin-mobile-bar"
      >
        {LINKS.slice(0, 4).map((l) => {
          const active = isActive(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              data-active={active}
              onTouchStart={() => { if (!active) warmPrefetch(); }}
              className={`admin-mbar-item flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${active ? 'text-cyan-300' : 'text-slate-400'}`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon name={l.icon} size={18} />
              {tp(l.key)}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => { setOpenState(true); warmPrefetch(); }}
          className="admin-mbar-item flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold text-slate-400"
          aria-expanded={open}
          aria-controls="admin-mobile-menu"
          data-testid="admin-mobile-more"
        >
          <Icon name="menu" size={18} />
          {t('more')}
        </button>
      </nav>

      {/* ── منوی کشویی کامل (تب‌های باقی‌مانده + زبان + خروج) ──────────── */}
      {open && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          onClick={() => setOpenState(false)}
        >
          {/* backdrop */}
          <div className="absolute inset-0 bg-black/60" aria-hidden />
          <div
            id="admin-mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label={t('navLabel')}
            onClick={(e) => e.stopPropagation()}
            className="admin-sheet absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-cyan-400/20 bg-[#0d1424] p-4"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
          >
            {/* هندل بصری + دکمه بستن (ضخیم برای لمس) */}
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15" aria-hidden />
            <button
              type="button"
              onClick={() => setOpenState(false)}
              className="absolute top-3 flex h-11 w-11 items-center justify-center rounded-full text-slate-400 active:bg-white/10"
              style={{ insetInlineEnd: '0.75rem' }}
              aria-label={t('closeMenu')}
              data-testid="admin-mobile-close"
            >
              <Icon name="close" size={18} />
            </button>

            <div className="grid grid-cols-2 gap-2">
              {LINKS.map((l, i) => {
                const active = isActive(l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    ref={i === 0 ? firstItemRef : undefined}
                    data-active={active}
                    aria-current={active ? 'page' : undefined}
                    className={`admin-mbar-item flex min-h-[52px] items-center gap-2.5 rounded-xl px-3 text-sm font-semibold ${active ? 'bg-cyan-500/15 text-cyan-200' : 'bg-white/[0.04] text-slate-300'}`}
                  >
                    <Icon name={l.icon} size={17} className={active ? 'text-cyan-300' : 'text-slate-500'} />
                    {tp(l.key)}
                  </Link>
                );
              })}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <AdminLocaleToggle locale={locale} />
              <button
                type="button"
                onClick={quickExit}
                data-testid="admin-quick-exit-mobile"
                className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border border-fuchsia-500/40 px-3 text-sm text-fuchsia-300 active:scale-[0.98]"
              >
                <Icon name="logout" size={15} />
                {t('quickExit')}
              </button>
            </div>

            {email && (
              <p dir="ltr" className="mt-3 truncate text-center text-[11px] text-slate-500">{email}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
