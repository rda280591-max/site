'use client';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { DashboardLayout } from '@/ui/layouts/DashboardLayout';
import { useNewsStore } from '@/state/newsStore';

/*
 * FIX — Unused JS: ویجت‌های داشبورد (StatsWidget/Card/Sparkline/CategoryWidget)
 * از این صفحه حذف شدند؛ NewsFeed تنها بخش سنگین است → dynamic import + skeleton
 * با ارتفاع ثابت تا CLS صفر بماند.
 */

const NewsFeed = dynamic(() => import('@/ui/components/organisms/NewsFeed'), {
  loading: () => (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading news">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="orbit-glass h-48 animate-pulse rounded-2xl" />
      ))}
    </div>
  ),
});

function NewsFeedPage() {
  // FIX — باگ «فید خبری با داشبورد فرقی نمی‌کند»:
  // این صفحه کپی داشبورد بود (همان آمار/روند/تگ‌ها). حالا یک صفحه خبری
  // واقعی و متمایز است: هدر اختصاصی + ابزار جستجو + فید تمام‌عرض.
  const t = useTranslations('news');
  const search = useNewsStore((s) => s.search);
  const setSearch = useNewsStore((s) => s.setSearch);

  return (
    <DashboardLayout requireAuth={false}>
      <div className="space-y-6">

        {/* سربرگ اختصاصی فید خبری */}
        <div className="orbit-fade-up flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight">
              <span className="bg-gradient-to-l from-violet-200 via-white to-cyan-200 bg-clip-text text-transparent">
                {t('title')}
              </span>
            </h1>
            <p className="text-xs text-orbit-text-muted mt-1">{t('subtitle')}</p>
          </div>
        </div>

        {/* جستجوی خبر — مخصوص همین صفحه */}
        <div className="relative">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-[border-color,box-shadow] duration-150 focus:border-[#7C3AED] focus:shadow-[0_0_0_3px_rgba(124,58,237,0.15)]"
            style={{
              background: 'var(--orbit-bg-elevated, rgba(255,255,255,0.04))',
              borderColor: 'var(--orbit-border)',
              color: 'var(--orbit-text)',
            }}
          />
        </div>

        {/* فید خبری تمام‌عرض — بدنه اصلی صفحه */}
        <NewsFeed />

      </div>
    </DashboardLayout>
  );
}

export default NewsFeedPage;
