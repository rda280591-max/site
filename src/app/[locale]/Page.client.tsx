'use client';
import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { DashboardLayout } from '@/ui/layouts/DashboardLayout';
import { WidgetGrid } from '@/ui/components/organisms/WidgetGrid';
import { StatsWidget } from '@/ui/components/organisms/StatsWidget';
import { CategoryWidget } from '@/ui/components/organisms/CategoryWidget';
import { Card } from '@/ui/components/molecules/Card';
import { Sparkline } from '@/ui/components/charts/Sparkline';
import { useTrend } from '@/modules/analytics/hooks/useTrend';
import { useTags } from '@/modules/analytics/hooks/useTags';
import { Badge } from '@/ui/components/atoms/Badge';
import LiveFeedPulse from '@/ui/components/molecules/LiveFeedPulse';
import { useNewsStore } from '@/state/newsStore';

// The feed owns the largest interactive subtree and is below the dashboard summary.
const NewsFeed = dynamic(() => import('@/ui/components/organisms/NewsFeed'), {
  loading: () => (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading news">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="orbit-glass h-32 animate-pulse rounded-2xl" />
      ))}
    </div>
  ),
});

function DashboardPage() {
  const t = useTranslations('dashboard');
  const articles = useNewsStore((s) => s.articles);
  const total = useNewsStore((s) => s.total);
  const provider = useNewsStore((s) => s.provider);
  const trend = useTrend(7);
  const tags = useTags(10);
  // FIX — آمار نادرست: مقالات تازه از seed/fetch فلگ‌های isRead/isBookmarked
  // را ندارند؛ membership Setهای محلی (markRead/toggleBookmark همین نشست)
  // باید OR شوند. انتخاب مستقیم count Setها → O(1) و بدون وابستگی به articles.
  const readCount = useNewsStore((s) => s.readIds.size);
  const bookmarkCount = useNewsStore((s) => s.bookmarkedIds.size);
  const bookmarked = useMemo(
    () => articles.filter((a) => a.isBookmarked).length + bookmarkCount,
    [articles, bookmarkCount],
  );
  const unread = useMemo(
    () => articles.filter((a) => !a.isRead).length - Math.min(readCount, articles.length),
    [articles, readCount],
  );

  return (
    <DashboardLayout requireAuth={false}>
      <div className="space-y-6">
        {/* سربرگ */}
        <div className="orbit-fade-up flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight">
              <span className="bg-gradient-to-l from-violet-200 via-white to-cyan-200 bg-clip-text text-transparent">
                {t('title')}
              </span>
            </h1>
            <p className="text-xs text-orbit-text-muted mt-1">{t('subtitle')}</p>
          </div>
          {provider && (
            <Badge tone={provider === 'newsapi' ? 'success' : 'secondary'}>
              {t('source', { provider })}
            </Badge>
          )}
        </div>

        {/* آمار */}
        <WidgetGrid className="orbit-fade-up" style={{ animationDelay: '60ms' }}>
          <StatsWidget label={t('statsTotal')} value={total} icon="sparkles" accent="#7C3AED" />
          <StatsWidget label={t('statsUnread')} value={unread} icon="dot" accent="#F59E0B" />
          <StatsWidget label={t('statsBookmarked')} value={bookmarked} icon="bookmark" accent="#06B6D4" />
        </WidgetGrid>

        {/* روند + دسته‌ها */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title={t('trendTitle')} className="lg:col-span-2">
            <div className="flex items-end justify-between gap-4">
              {/* FIX a11y — نمودار SVG برای screen reader بی‌معنا بود؛ role=img + aria-label */}
              <div
                role="img"
                aria-label={`${t('trendTitle')}: ${trend.reduce((a, b) => Math.max(a, b), 0)}`}
              >
                <Sparkline data={trend.length ? trend : [0, 0, 0, 0, 0, 0, 0]} width={600} height={90} />
              </div>
              {/* ORBIT — Neon Pulse: ضربان زنده فید (SVG خالص، انیمیشن CSS-only) */}
              <LiveFeedPulse />
            </div>
          </Card>
          <CategoryWidget articles={articles} />
        </div>

        {/* تگ‌های داغ */}
        {tags.length > 0 && (
          <Card title={t('hotTags')} subtitle={t('hotTagsSubtitle')}>
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <span
                  key={t.word}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium cursor-default transition-[border-color,opacity] duration-150 hover:opacity-80"
                  style={{
                    background: 'rgba(139, 92, 246, 0.15)',
                    color: '#C4B5FD',
                    borderColor: 'rgba(139, 92, 246, 0.3)',
                    boxShadow: '0 0 8px rgba(139, 92, 246, 0.15)',
                  }}
                >
                  <span className="text-violet-300">{t.word}</span>
                  <span className="text-violet-300 text-2xs">· {t.count}</span>
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* فید خبری */}
        <div>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-l from-violet-500 to-cyan-400" />
            {t('latest')}
          </h2>
          <NewsFeed />
        </div>
      </div>
    </DashboardLayout>
  );
}

export default DashboardPage;
