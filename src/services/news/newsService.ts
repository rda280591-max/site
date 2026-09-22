// ORBIT — هماهنگ‌کننده‌ی خبر
import type { NewsCategoryId } from '@/core/config';
import { Result, Ok, tryCatch } from '@/core/result';
import { createLogger } from '@/core/logger';
import { eventBus } from '@/core/eventBus';
import { cacheService } from '@/services/cache/cacheService';
import { NewsApiProvider } from './newsApi';
import { MockProvider } from './mockProvider';
import { RssProvider } from './rssProvider';
import { sanitizeText } from '@/utils/sanitize';
import { uid } from '@/utils/formatters';
import { isValidArticle } from '@/utils/validators';
import { parseDate } from '@/services/http/interceptors';
import type { RawNewsApiArticle } from '@/services/http/interceptors';
import type { Article, NewsQuery, NewsResponse } from '@/types/news';

const log = createLogger('services.news');

function normalizeArticle(raw: RawNewsApiArticle, category: NewsCategoryId): Article | null {
  const title = sanitizeText(raw.title ?? '', 200);
  const url = raw.url ?? '';
  if (!title || !url) return null;

  const summary = sanitizeText(raw.description ?? raw.content ?? '', 300);
  const publishedAt = parseDate(raw.publishedAt);

  const article: Article = {
    id: uid('art'),
    title,
    summary,
    content: raw.content ? sanitizeText(raw.content, 2000) : undefined,
    url,
    imageUrl: raw.urlToImage ?? undefined,
    author: raw.author ?? undefined,
    source: {
      id: raw.source?.id ?? 'unknown',
      name: raw.source?.name ?? 'منبع نامشخص',
      url: raw.url ?? undefined,
    },
    category,
    tags: [],
    publishedAt,
    fetchedAt: Date.now(),
    isRead: false,
    isBookmarked: false,
  };

  return isValidArticle(article) ? article : null;
}

function inferCategory(raw: RawNewsApiArticle, fallback: NewsCategoryId): NewsCategoryId {
  const text = `${raw.title ?? ''} ${raw.description ?? ''}`.toLowerCase();
  if (/\bai\b|هوش مصنوعی|machine learning/.test(text)) return 'ai';
  if (/gadget|گجت|wearable/.test(text)) return 'gadgets';
  if (/security|امنیت|hack/.test(text)) return 'security';
  if (/space|فضا|nasa|moon/.test(text)) return 'space';
  if (/startup|استارتاپ|funding/.test(text)) return 'startups';
  return fallback;
}

function cacheKey(query: NewsQuery): string {
  return `news:${[
    query.category ?? 'all',
    query.search ?? '',
    query.page ?? 1,
    query.pageSize ?? 20,
    query.sortBy ?? 'publishedAt',
  ].join('|')}`;
}

export async function fetchNews(query: NewsQuery = {}): Promise<Result<NewsResponse>> {
  const key = cacheKey(query);

  const cached = cacheService.get<NewsResponse>(key);
  if (cached) {
    log.debug('پاسخ از کش.', { key });
    return Ok({ ...cached, fromCache: true });
  }

  const requestedCategory: NewsCategoryId =
    query.category && query.category !== 'all' ? query.category : 'ai';

  let raw = await NewsApiProvider.fetch(query);
  let provider: NewsResponse['provider'] = 'newsapi';

  if (!raw.ok) {
    log.warn('NewsAPI ناموفق؛ تلاش با RSS.');
    const rss = await RssProvider.fetch();
    if (rss.ok) {
      raw = Ok({ articles: rss.value, total: rss.value.length });
      provider = 'rss';
    }
  }

  if (!raw.ok) {
    log.warn('RSS نیز ناموفق؛ استفاده از Mock.');
    const mock = await MockProvider.fetch(query);
    raw = Ok(mock);
    provider = 'mock';
  }

  return tryCatch(() => {
    const normalized = (raw.value.articles ?? [])
      .map((r) => normalizeArticle(r, inferCategory(r, requestedCategory)))
      .filter((a): a is Article => a !== null);

    const response: NewsResponse = {
      articles: normalized,
      total: raw.value.total,
      fromCache: false,
      provider,
    };

    cacheService.set(key, response);
    eventBus.emit('news:fetched', { count: normalized.length, category: query.category });
    return response;
  });
}

export function getArticleById(id: string): Article | undefined {
  const keys = cacheService.keys('news:');
  for (const k of keys) {
    const cached = cacheService.get<NewsResponse>(k);
    const found = cached?.articles.find((a) => a.id === id);
    if (found) return found;
  }
  return undefined;
}

export const newsService = { fetch: fetchNews, getById: getArticleById };