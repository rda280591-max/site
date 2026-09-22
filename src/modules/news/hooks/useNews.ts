'use client';
import { useEffect } from 'react';
import { useNewsStore } from '@/state/newsStore';

export function useNews(autoLoad = true) {
  const articles = useNewsStore((s) => s.articles);
  const status = useNewsStore((s) => s.status);
  const error = useNewsStore((s) => s.error);
  const refresh = useNewsStore((s) => s.refresh);
  const loadMore = useNewsStore((s) => s.loadMore);
  const total = useNewsStore((s) => s.total);
  const provider = useNewsStore((s) => s.provider);

  useEffect(() => {
    if (autoLoad && status === 'idle') void refresh();
  }, [autoLoad, status, refresh]);

  return {
    articles,
    status,
    error,
    total,
    provider,
    hasMore: articles.length < total,
    refresh,
    loadMore,
  };
}