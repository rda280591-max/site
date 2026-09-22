'use client';
import React from 'react';
import { DashboardLayout } from '@/ui/layouts/DashboardLayout';
import { Card } from '@/ui/components/molecules/Card';
import { Sparkline } from '@/ui/components/charts/Sparkline';
import { BarChart } from '@/ui/components/charts/BarChart';
import { useNews } from '@/modules/news/hooks/useNews';
import { useTrend } from '@/modules/analytics/hooks/useTrend';
import { NEWS_CATEGORIES } from '@/core/config';

export default function AnalyticsPage() {
  const { articles } = useNews();
  const trend = useTrend(7);

  const barData = NEWS_CATEGORIES.map((c) => ({
    label: c.label,
    value: articles.filter((a) => a.category === c.id).length,
    color: c.color,
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="orbit-fade-up">
          <h1 className="text-2xl font-black tracking-tight">تحلیل‌ها</h1>
          <p className="text-xs text-orbit-text-muted mt-1">روندها و توزیع محتوا در نگاهی عمیق‌تر</p>
        </div>
        <Card title="روند ۷ روزه">
          <Sparkline
            data={trend.length ? trend : [0, 0, 0, 0, 0, 0, 0]}
            width={700}
            height={120}
          />
        </Card>
        <Card title="مقایسه‌ی دسته‌ها">
          <BarChart data={barData} />
        </Card>
      </div>
    </DashboardLayout>
  );
}