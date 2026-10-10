'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import AdminLocaleToggle from './AdminLocaleToggle';
import type { AppLocale } from '@/i18n/routing';

/**
 * نوار بالای پنل ادمین — فقط موبایل (زیر md).
 *
 * FIX (بازخورد کاربر: «منو همبرگری می‌خواهم + فونت‌ها و UI درست نیست»):
 * روی موبایل هیچ هدر ثابتی وجود نداشت؛ برند، سوییچ زبان و منوی همبرگری هیچ‌کجا
 * دیده نمی‌شدند (سوییچ زبان فقط داخل شیت «بیشتر» پنهان بود). حالا یک top bar
 * چسبان اضافه شده که مثل اپ‌های واقعی است:
 *   - لوگو + نام برند (سمت start)
 *   - سوییچ زبان همیشه در دسترس (بدون باز کردن منو)
 *   - دکمه همبرگری با آیکون سه‌خطی ⇄ بستن (X) که شیت را باز/بسته می‌کند
 * آریا: aria-expanded/controls روی دکمه منو + nav landmark مجزا.
 */
export default function AdminTopBar({
  email,
  locale,
  menuOpen,
  onToggleMenu,
}: {
  email: string | null;
  locale: AppLocale;
  menuOpen: boolean;
  onToggleMenu: () => void;
}) {
  const pathname = usePathname();
  const t = useTranslations('admin');
  const tp = useTranslations('admin.pages');

  // عنوان صفحه فعال برای نمایش در وسط بار (حس native app).
  // FIX typecheck: لینک‌ها/کلیدها باید literal type بمانند تا tp(titleKey) با
  // NamespacedMessageKeys next-intl سازگار باشد (string ساده reject می‌شود).
  const titleKey: PageKey = pickPage(pathname);

  return (
    <header
      className="admin-mtop fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-2 border-b border-white/10 bg-[#0B0E17]/92 px-3 backdrop-blur-md md:hidden"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
      data-testid="admin-mobile-topbar"
    >
      {/* برند — لینک به داشبورد */}
      <Link
        href="/admin"
        className="flex min-w-0 shrink-0 items-center gap-2"
        aria-label={t('brand')}
        data-testid="admin-mobile-brand"
      >
        <span
          aria-hidden
          className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-cyan-400 to-fuchsia-500 text-[13px] font-black text-slate-950 shadow-[0_0_14px_rgba(34,211,238,0.35)]"
        >
          O
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[13px] font-bold tracking-wide text-cyan-100">{t('brand')}</span>
          <span className="block truncate text-[11px] font-medium text-slate-400">{tp(titleKey)}</span>
        </span>
      </Link>

      <div className="flex-1" />

      {/* سوییچ زبان — همیشه در دسترس، بدون باز کردن منو */}
      <AdminLocaleToggle locale={locale} />

      {/* ایمیل کوتاه‌شده ادمین (اختیاری، فقط اگر جا باشد) */}
      {email ? (
        <span dir="ltr" className="hidden max-w-[22ch] truncate text-[11px] text-slate-500 sm:inline" aria-hidden>
          {email.split('@')[0]}
        </span>
      ) : null}

      {/* دکمه همبرگری — باز/بسته کردن شیت منو */}
      <button
        type="button"
        onClick={onToggleMenu}
        aria-expanded={menuOpen}
        aria-controls="admin-mobile-menu"
        aria-label={menuOpen ? t('closeMenu') : t('more')}
        data-testid="admin-mobile-hamburger"
        className={`admin-hamb grid h-11 w-11 shrink-0 place-items-center rounded-xl border transition-colors ${
          menuOpen
            ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-200'
            : 'border-white/10 bg-white/[0.06] text-slate-200'
        }`}
      >
        <span aria-hidden className="relative block h-[18px] w-[20px]">
          {/* سه خط با morph به X — transform GPU، بدون reflow */}
          <span className={`admin-hamb-l admin-hamb-l1 ${menuOpen ? 'is-x' : ''}`} />
          <span className={`admin-hamb-l admin-hamb-l2 ${menuOpen ? 'is-x' : ''}`} />
          <span className={`admin-hamb-l admin-hamb-l3 ${menuOpen ? 'is-x' : ''}`} />
        </span>
      </button>
    </header>
  );
}

// کلید ترجمه ⇄ مسیر (همسان LINKS در AdminMobileNav/Sidebar).
// as const حیاتی است: بدون آن، نوع کلیدها به string گسترده می‌شود و
// tp(titleKey) در next-intl با NamespacedMessageKeys نمی‌خواند (TS2345).
const PAGES = [
  { key: 'dashboard', href: '/admin' },
  { key: 'news', href: '/admin/news' },
  { key: 'feeds', href: '/admin/feeds' },
  { key: 'audit', href: '/admin/audit' },
  { key: 'users', href: '/admin/users' },
  { key: 'settings', href: '/admin/settings' },
] as const;

type PageKey = (typeof PAGES)[number]['key'];

/** دقیق‌ترین تطبیق: /admin/news/x → news؛ /admin → dashboard */
function pickPage(pathname: string): PageKey {
  for (let i = PAGES.length - 1; i >= 0; i--) {
    const p = PAGES[i];
    if (p.href !== '/admin' && pathname.startsWith(p.href)) return p.key;
  }
  return 'dashboard';
}
