import type { Article, NewsQuery } from '@/types/news';
import { normalizePersian } from '@/utils/sanitize';

export function filterByCategory(articles: Article[], category: NewsQuery['category']): Article[] {
  if (!category || category === 'all') return articles;
  return articles.filter((a) => a.category === category);
}

export function filterBySearch(articles: Article[], term: string): Article[] {
  const q = normalizePersian(term.toLowerCase());
  if (!q) return articles;
  return articles.filter((a) =>
    normalizePersian(`${a.title} ${a.summary}`.toLowerCase()).includes(q),
  );
}