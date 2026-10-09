'use client';
import { useMemo } from 'react';
import { useNewsStore } from '@/state/newsStore';
import { normalizePersian } from '@/utils/sanitize';

const STOP = new Set([
  'و','در','به','از','که','این','را','با','است','برای','تا','بر','هم','یک',
  'the','a','an','of','to','in','for','and','on',
]);

export interface TagCount { word: string; count: number }

export function useTags(limit = 12): TagCount[] {
  const articles = useNewsStore((s) => s.articles);
  return useMemo(() => {
    const freq = new Map<string, number>();
    for (const a of articles) {
      const words = normalizePersian(a.title)
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2 && !STOP.has(w));
      for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
    }
    return Array.from(freq.entries())
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }, [articles, limit]);
}