'use client';
import { useMemo } from 'react';
import { NEWS_CATEGORIES, type NewsCategoryId } from '@/core/config';
import { useNewsStore } from '@/state/newsStore';

export interface CategoryWithCount {
  id: NewsCategoryId | 'all';
  label: string;
  color: string;
  count: number;
}

export function useCategories() {
  const articles = useNewsStore((s) => s.articles);
  const active = useNewsStore((s) => s.activeCategory);
  const setActive = useNewsStore((s) => s.setCategory);

  const categories = useMemo<CategoryWithCount[]>(() => {
    const all: CategoryWithCount = { id: 'all', label: 'همه', color: '#7C3AED', count: articles.length };
    const rest = NEWS_CATEGORIES.map((c) => ({
      id: c.id,
      label: c.label,
      color: c.color,
      count: articles.filter((a) => a.category === c.id).length,
    }));
    return [all, ...rest];
  }, [articles]);

  return { categories, active, setActive };
}