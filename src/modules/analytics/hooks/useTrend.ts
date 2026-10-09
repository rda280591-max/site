'use client';
import { useMemo } from 'react';
import { useNewsStore } from '@/state/newsStore';

const DAY = 86_400_000;

export function useTrend(days = 7): number[] {
  const articles = useNewsStore((s) => s.articles);
  return useMemo(() => {
    // "Today" baseline = start of the current day (not the latest article's date), keeping buckets stable.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const today = startOfToday.getTime();

    // PERF — یک‌بار ساخت Date در هر مقاله + محاسبه با الگوی «نیمه‌شبِ روز» به‌جای
    // دو آبجکت Date در هر آیتم؛ رفتار قبلی حفظ شده اما allocation نصف می‌شود.
    const buckets = new Array(days).fill(0) as number[];
    for (const a of articles) {
      const d = new Date(a.publishedAt);
      if (Number.isNaN(d.getTime())) continue;
      d.setHours(0, 0, 0, 0);
      const diff = Math.round((today - d.getTime()) / DAY);
      if (diff >= 0 && diff < days) buckets[days - 1 - diff] += 1;
    }
    return buckets;
  }, [articles, days]);
}