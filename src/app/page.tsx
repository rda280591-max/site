'use client';
import React from 'react';
import { DashboardLayout } from '@/ui/layouts/DashboardLayout';
import { WidgetGrid } from '@/ui/components/organisms/WidgetGrid';
import { StatsWidget } from '@/ui/components/organisms/StatsWidget';
import { CategoryWidget } from '@/ui/components/organisms/CategoryWidget';
import { NewsFeed } from '@/ui/components/organisms/NewsFeed';
import { Card } from '@/ui/components/molecules/Card';
import { Sparkline } from '@/ui/components/charts/Sparkline';
import { useNews } from '@/modules/news/hooks/useNews';
import { useTrend } from '@/modules/analytics/hooks/useTrend';
import { useTags } from '@/modules/analytics/hooks/useTags';
import { Badge } from '@/ui/components/atoms/Badge';

export default function DashboardPage() {
  const { articles, total, provider } = useNews();
  const trend = useTrend(7);
  const tags = useTags(10);
  const bookmarked = articles.filter((a) => a.isBookmarked).length;
  const unread = articles.filter((a) => !a.isRead).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* سربرگ */}
        <div className="orbit-fade-up flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight">
              <span className="bg-gradient-to-l from-violet-200 via-white to-cyan-200 bg-clip-text text-transparent">
         داشبورد
              </span>
            </h1>
            <p className="text-xs text-orbit-text-muted mt-1">نمای کلی</p>
          </div>
          {provider && (
            <Badge tone={provider === 'newsapi' ? 'success' : 'secondary'}>
              منبع: {provider}
            </Badge>
          )}
        </div>

        {/* آمار */}
        <WidgetGrid className="orbit-fade-up" style={{ animationDelay: '60ms' }}>
          <StatsWidget label="کل اخبار" value={total} icon="sparkles" accent="#7C3AED" />
          <StatsWidget label="خوانده‌نشده" value={unread} icon="dot" accent="#F59E0B" />
          <StatsWidget label="بوکمارک" value={bookmarked} icon="bookmark" accent="#06B6D4" />
        </WidgetGrid>

        {/* روند + دسته‌ها */}
        <div className="orbit-fade-up grid gap-4 lg:grid-cols-3" style={{ animationDelay: '120ms' }}>
          <Card title="روند ۷ روز" className="lg:col-span-2">
            <Sparkline data={trend.length ? trend : [0, 0, 0, 0, 0, 0, 0]} width={600} height={90} />
          </Card>
          <CategoryWidget articles={articles} />
        </div>

        {/* تگ‌های داغ */}
        {tags.length > 0 && (
          <Card title="تگ‌های داغ" subtitle="کلمات کلیدی پربسامد">
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <span
                  key={t.word}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all hover:scale-105 cursor-default"
                  style={{
                    background: 'rgba(139, 92, 246, 0.15)',
                    color: '#C4B5FD',
                    borderColor: 'rgba(139, 92, 246, 0.3)',
                    boxShadow: '0 0 8px rgba(139, 92, 246, 0.15)',
                  }}
                >
                  <span className="text-violet-300">{t.word}</span>
                  <span className="text-violet-400/70 text-2xs">· {t.count}</span>
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* فید خبری */}
        <div className="orbit-fade-up" style={{ animationDelay: '180ms' }}>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-l from-violet-500 to-cyan-400" />
            آخرین اخبار
          </h2>
          <NewsFeed />
        </div>
      </div>
    </DashboardLayout>
  );
}