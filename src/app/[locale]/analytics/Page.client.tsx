'use client';
import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { DashboardLayout } from '@/ui/layouts/DashboardLayout';
import { useTrend } from '@/modules/analytics/hooks/useTrend';
import { useCategoryLabels } from '@/ui/hooks/useCategoryLabels';
import { useNewsStore } from '@/state/newsStore';

/*
 * FIX — TBT/LCP: نمودارها زیر fold هستند؛ با lazy + skeleton ارتفاع‌ثابت
 * بارگذاری می‌شوند (باندل اولیه کوچک‌تر، CLS صفر).
 */
const Card = dynamic(
  () => import('@/ui/components/molecules/Card').then((m) => m.Card),
  { loading: () => <div className="orbit-glass h-[180px] rounded-2xl animate-pulse" />, ssr: false },
);
const Sparkline = dynamic(
  () => import('@/ui/components/charts/Sparkline').then((m) => m.Sparkline),
  { ssr: false, loading: () => <div style={{ height: 120 }} /> },
);
const BarChart = dynamic(() => import('@/ui/components/charts/BarChart'), {
  loading: () => <div className="h-40 animate-pulse rounded-xl bg-white/5" />,
  ssr: false,
});

function AnalyticsPage() {
  const t = useTranslations('analytics');
  const articles = useNewsStore((s) => s.articles);
  const trend = useTrend(7);
  const { categories } = useCategoryLabels();

  const barData = useMemo(() => {
    return categories.map((c) => ({
      label: c.label,
      value: articles.filter((a) => a.category === c.id).length,
      color: c.color,
    }));
  }, [categories, articles]);

  return (
    <DashboardLayout requireAuth={false}>
      <div className="space-y-6">
        <div className="orbit-fade-up">
          <h1 className="text-2xl font-black tracking-tight">{t('title')}</h1>
          <p className="text-xs text-orbit-text-muted mt-1">{t('subtitle')}</p>
        </div>
        <Card title={t('trendTitle')}>
          {/* FIX a11y — نمودار SVG برای screen reader کاملاً بی‌معنا بود؛
              حالا role=img + aria-label توصیفی (بیشینه روند ۷ روزه). */}
          <div
            role="img"
            aria-label={`${t('trendTitle')}: ${trend.reduce((a, b) => Math.max(a, b), 0)}`}
          >
            <Sparkline
              data={trend.length ? trend : [0, 0, 0, 0, 0, 0, 0]}
              width={700}
              height={120}
            />
          </div>
        </Card>
        <Card title={t('compareTitle')}>
          <BarChart data={barData} />
        </Card>
      </div>
    </DashboardLayout>
  );
}

export default AnalyticsPage;
