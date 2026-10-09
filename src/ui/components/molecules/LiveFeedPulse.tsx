// ORBIT — LiveFeedPulse: بصری‌سازی ضربان فید زنده با SVG خالص
// بدون کتابخانه چارت؛ انیمیشن فقط CSS (keyframe) است → صفر کار JS در هر فریم.
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNewsStore } from '@/state/newsStore';
import { NEWS_CATEGORIES, type NewsCategoryId } from '@/core/config';

const BAR_COUNT = 12;

/** رنگ دسته از پیکربندی مرکزی — منبع حقیقت واحد برای color-coding. */
const CATEGORY_COLOR: Record<string, string> = Object.fromEntries(
  NEWS_CATEGORIES.map((c) => [c.id, c.color]),
);

interface LiveFeedPulseProps {
  /** حداکثر تعداد آیتم جدیدی که در یک «burst» نمایش داده می‌شود. */
  maxBurst?: number;
}

export default function LiveFeedPulse({ maxBurst = 6 }: LiveFeedPulseProps) {
  const articles = useNewsStore((s) => s.articles);
  // bursting یک state بصری است (نه ref) تا قانون «عدم دسترسی به ref هنگام render» نقض نشود.
  const [bursting, setBursting] = useState(false);
  const prevCountRef = useRef(articles.length);

  useEffect(() => {
    const delta = articles.length - prevCountRef.current;
    prevCountRef.current = articles.length;
    if (delta > 0) {
      setBursting(true);
      const ms = Math.min(delta, maxBurst) * 400 + 800;
      const timer = window.setTimeout(() => setBursting(false), ms);
      return () => window.clearTimeout(timer);
    }
  }, [articles.length, maxBurst]);

  // توزیع بلندمرتبه‌ای دسته‌ها (O(n) یک‌بار، نه per-render سنگین)
  const dominantColor = useMemo(() => {
    const counts = new Map<NewsCategoryId, number>();
    for (const a of articles.slice(0, 40)) {
      counts.set(a.category, (counts.get(a.category) ?? 0) + 1);
    }
    let best: string | null = null;
    let bestN = 0;
    for (const [cat, n] of counts) {
      if (n > bestN) { bestN = n; best = cat; }
    }
    return (best && CATEGORY_COLOR[best]) || 'var(--orbit-primary)';
  }, [articles]);

  return (
    <div
      role="img"
      data-testid="live-feed-pulse"
      aria-label={bursting ? 'New headlines arriving' : 'Live feed activity'}
      className="flex items-end gap-1 h-8"
    >
      <svg width={BAR_COUNT * 7} height="32" viewBox={`0 0 ${BAR_COUNT * 7} 32`} fill="none">
        {Array.from({ length: BAR_COUNT }, (_, i) => (
          <rect
            key={i}
            x={i * 7}
            y={4}
            width={4}
            height={28}
            rx={2}
            fill={dominantColor}
            className={['orbit-pulse-bar', bursting ? 'orbit-pulse-bar--burst' : ''].join(' ')}
            style={{ animationDelay: `${i * 90}ms` }}
          />
        ))}
      </svg>
    </div>
  );
}
