'use client';
import React, { useEffect } from 'react';
import { NewsCard } from './NewsCard';
import { Skeleton } from '../atoms/Skeleton';
import { Button } from '../atoms/Button';
import { Icon } from '../atoms/Icon';
import { ErrorBoundary } from '@/core/errorBoundary';
import { useNewsStore } from '@/state/newsStore';

export function NewsFeed() {
  const articles = useNewsStore((s) => s.articles);
  const status = useNewsStore((s) => s.status);
  const error = useNewsStore((s) => s.error);
  const refresh = useNewsStore((s) => s.refresh);
  const loadMore = useNewsStore((s) => s.loadMore);
  const total = useNewsStore((s) => s.total);

  useEffect(() => {
    if (status === 'idle') void refresh();
  }, [refresh, status]);

  if (status === 'loading' && articles.length === 0) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="orbit-glass rounded-2xl overflow-hidden p-4 space-y-3">
            <Skeleton height={16} width="80%" />
            <Skeleton height={12} width="100%" />
            <Skeleton height={12} width="60%" />
          </div>
        ))}
      </div>
    );
  }

  if (status === 'error' && articles.length === 0) {
    return (
      <div className="orbit-glass rounded-2xl p-8 text-center">
        <div className="text-4xl mb-3">📡</div>
        <h3 className="text-base font-bold mb-2">دریافت اخبار ناموفق بود</h3>
        <p className="text-xs text-orbit-text-secondary mb-4">{error}</p>
        <Button onClick={() => void refresh()} iconLeft={<Icon name="refresh" size={16} />}>تلاش مجدد</Button>
      </div>
    );
  }

  if (status === 'success' && articles.length === 0) {
    return (
      <div className="orbit-glass rounded-2xl p-10 text-center">
        <div className="text-4xl mb-3">🔍</div>
        <p className="text-sm text-orbit-text-secondary">خبری یافت نشد.</p>
      </div>
    );
  }

  return (
    <ErrorBoundary scope="NewsFeed">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {articles.map((a) => <NewsCard key={a.id} article={a} />)}
        </div>
        {articles.length < total && (
          <div className="flex justify-center pt-4">
            <Button variant="secondary" loading={status === 'loading'} onClick={() => void loadMore()}>بارگذاری بیشتر</Button>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
export default NewsFeed;