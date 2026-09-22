// ORBIT — اتصال به NewsAPI
import { API_KEYS } from '@/core/config';
import { ConfigError } from '@/core/errors';
import { Result, Err, tryCatch } from '@/core/result';
import { createLogger } from '@/core/logger';
import { get } from '@/services/http/client';
import { normalizeNewsApiResponse, RawNewsApiArticle } from '@/services/http/interceptors';
import type { NewsQuery } from '@/types/news';

const log = createLogger('services.news.newsapi');

export interface NewsApiResult {
  articles: RawNewsApiArticle[];
  total: number;
}

export async function fetchFromNewsApi(query: NewsQuery = {}): Promise<Result<NewsApiResult>> {
  if (!API_KEYS.newsApi) {
    return Err(new ConfigError('کلید NewsAPI تنظیم نشده است.'));
  }

  const pageSize = Math.min(query.pageSize ?? 20, 100);

  const result = await get<unknown>(
    '/everything',
    {
      q: query.search || 'technology OR AI OR gadget',
      language: 'en',
      sortBy: query.sortBy === 'relevance' ? 'relevancy' : 'publishedAt',
      page: query.page ?? 1,
      pageSize,
      from: query.from ? new Date(query.from).toISOString() : undefined,
      to: query.to ? new Date(query.to).toISOString() : undefined,
    },
    API_KEYS.newsApi,
  );

  if (!result.ok) return result;

  return tryCatch(() => {
    const normalized = normalizeNewsApiResponse(result.value);
    log.info(`دریافت ${normalized.articles.length} خبر از NewsAPI`, { total: normalized.total });
    return normalized;
  });
}

export const NewsApiProvider = { fetch: fetchFromNewsApi };