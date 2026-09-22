'use client';
import { useMemo } from 'react';
import { useNewsStore } from '@/state/newsStore';

const DAY = 86_400_000;

export function useTrend(days = 7): number[] {
  const articles = useNewsStore((s) => s.articles);
  const now = articles.reduce((latest, article) => Math.max(latest, article.publishedAt), 0);
  return useMemo(() => {
    const buckets = new Array(days).fill(0) as number[];
    for (const a of articles) {
      const d = Math.floor((now - a.publishedAt) / DAY);
      if (d >= 0 && d < days) buckets[days - 1 - d] += 1;
    }
    return buckets;
  }, [articles, days, now]);
}