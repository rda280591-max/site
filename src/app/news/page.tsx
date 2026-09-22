'use client';
import React from 'react';
import { DashboardLayout } from '@/ui/layouts/DashboardLayout';
import { NewsFeed } from '@/ui/components/organisms/NewsFeed';
import { Tabs } from '@/ui/components/molecules/Tabs';
import { useCategories } from '@/modules/news/hooks/useCategories';
import type { NewsCategoryId } from '@/core/config';

export default function NewsPage() {
  const { categories, active, setActive } = useCategories();
  const tabs = categories.map((c) => ({ id: c.id, label: c.label, count: c.count }));

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="orbit-fade-up">
          <h1 className="text-2xl font-black tracking-tight">فید خبری</h1>
          <p className="text-xs text-orbit-text-muted mt-1">آخرین اخبار به‌روزشده در همه دسته‌ها</p>
        </div>
        <Tabs items={tabs} value={active} onChange={(id) => setActive(id as NewsCategoryId | 'all')} />
        <NewsFeed />
      </div>
    </DashboardLayout>
  );
}