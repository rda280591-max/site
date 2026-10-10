'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
 * PERF — پیش‌fetch هوشمند مسیرهای ادمین.
 * صفحات پنل force-dynamic هستند؛ بدون prefetch، هر سوییچ تب = رندر کامل سمت
 * سرور (گارد + کوئری‌ها) که روی موبایل چند صد میلی‌ثانیه تاخیر محسوس می‌سازد.
 * با router.prefetch به مسیر مجاور، RSC payload در پس‌زمینه آماده می‌شود و
 * کلیک کاربر تقریباً آنی رندر می‌گردد. زمان‌بندی requestIdleCallback تا
 * prefetch وسط تایپ/اسکرول کاربر، CPU و شبکه را اشباع نکند؛ fallback به
 * setTimeout(۳s) برای مرورگرهای بدون پشتیبانی (iOS Safari قدیمی).
 */
function useAdminPrefetch(): (href: string) => void {
  const router = useRouter();
  return (href: string) => {
    const go = () => {
      try {
        router.prefetch(href);
      } catch {
        /* prefetch بهترین‌تلاش است؛ شکست نباید UI را بشکند */
      }
    };
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void })
        .requestIdleCallback?.(go, { timeout: 2000 });
    } else {
      setTimeout(go, 3000);
    }
  };
}

/** سایدبار ادمین — با آیکون، نشانگر گرادیانی آیتم فعال و لبه نورانی متحرک. */
export default function AdminSidebar({ email, locale }: { email: string | null; locale: AppLocale }) {
  const pathname = usePathname();
  const router = useRouter();
  const prefetch = useAdminPrefetch();
  // FIX (دوزبانه‌سازی): همه برچسب‌ها از namespace admin در messages/admin.json
  const tp = useTranslations('admin.pages');
  const t = useTranslations('admin');

  async function quickExit() {
    // FIX — «رفرش کامل صفحه هنگام ناوبری»: قبلاً فقط لوکال استور پاک می‌شد و
    // کوکی‌های sb-* روی سرور معتبر می‌ماندند؛ حالا logout واقعی server-side.
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      /* شبکه قطع باشد هم لاگین مجدد بی‌خطر است */
    }
    await lazyAuth.signOut();
    router.replace('/'); // ناوبری داخلی با router (به‌جای window.location) → بدون reload کامل
  }

  return (
    <aside className="admin-rail sticky top-0 hidden h-screen w-60 shrink-0 flex-col p-4 md:flex" aria-label={t('navLabel')}>
      {/* برند — حرف اول داخل کاشی گرادیانی، مثل لوگوی دستی یک طراح */}
      <div className="flex items-center gap-2.5 px-1 pb-5">
        <span aria-hidden className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-fuchsia-500 text-sm font-black text-slate-950 shadow-[0_0_16px_rgba(34,211,238,0.35)]">
          O
        </span>
        <p className="text-base font-bold leading-tight tracking-wide text-cyan-200">
          {t('brand')}
          <span className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-fuchsia-300/80">{t('brandSuffix')}</span>
        </p>
      </div>

      <nav className="flex flex-col gap-1">
        {LINKS.map((l) => {
          const active = l.href === '/admin' ? pathname === '/admin' : pathname.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href} data-testid={l.testid} aria-current={active ? 'page' : undefined}
              data-active={active}
              onMouseEnter={() => !active && prefetch(l.href)}
              onTouchStart={() => !active && prefetch(l.href)}
              onFocus={() => !active && prefetch(l.href)}
              className={`admin-nav-item flex items-center gap-2.5 px-3 py-2 text-sm ${active ? '' : 'text-slate-300 hover:bg-white/5 hover:text-slate-100'}`}>
              <Icon name={l.icon} size={16} className={active ? 'text-cyan-300' : 'text-slate-500'} />
              {tp(l.key)}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3 pt-4">
        {/* FIX (دوزبانه‌سازی): سوییچر زبان پنل — همان کوکی ORBIT_LOCALE سایت */}
        <AdminLocaleToggle locale={locale} />
        {/* پروفایل ادمین: آواتار حروف اول + ایمیل — حس «انسان پشت این پنل» */}
        <div className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.03] px-2.5 py-2">
          <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-cyan-500/15 text-xs font-bold text-cyan-200">
            {(email ?? '?').slice(0, 1).toUpperCase()}
          </span>
          <p dir="ltr" className="min-w-0 truncate text-start text-xs text-slate-400" title={email ?? ''}>{email}</p>
        </div>
        <button type="button" onClick={quickExit} data-testid="admin-quick-exit"
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-fuchsia-500/40 px-3 py-2 text-sm text-fuchsia-300 transition hover:bg-fuchsia-500/10 active:scale-[0.98]">
          <Icon name="logout" size={15} />
          {t('quickExit')}
        </button>
      </div>
    </aside>
  );
}
