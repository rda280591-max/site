import type { Article, NewsQuery } from '@/types/news';

export type SortMode = NonNullable<NewsQuery['sortBy']>;

export function sortArticles(articles: Article[], mode: SortMode = 'publishedAt'): Article[] {
  return [...articles].sort((a, b) =>
    mode === 'relevance'
      ? (b.relevance ?? 0) - (a.relevance ?? 0)
      : b.publishedAt - a.publishedAt,
  );
}