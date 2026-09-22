// ORBIT — پروایدر RSS
import { ENDPOINTS } from '@/core/config';
import { Result, tryCatch } from '@/core/result';
import { createLogger } from '@/core/logger';
import { get } from '@/services/http/client';
import { pick } from '@/services/http/interceptors';
import type { RawNewsApiArticle } from '@/services/http/interceptors';

const log = createLogger('services.news.rss');

export const DEFAULT_FEEDS = [
  'https://feeds.arstechnica.com/arstechnica/index',
  'https://www.theverge.com/rss/index.xml',
  'https://techcrunch.com/feed/',
] as const;

export interface RssItem {
  title: string;
  link: string;
  description?: string;
  pubDate?: string;
  author?: string;
}

export async function fetchFromRss(feedUrl: string = DEFAULT_FEEDS[0]): Promise<Result<RawNewsApiArticle[]>> {
  const result = await get<unknown>(ENDPOINTS.rssFallback, { url: feedUrl });

  if (!result.ok) {
    log.warn('دریافت RSS ناموفق.', { feedUrl });
    return result;
  }

  return tryCatch(() => {
    const items = (pick<unknown[]>(result.value, 'items') ?? []) as RssItem[];
    return items.map<RawNewsApiArticle>((item) => ({
      title: item.title,
      description: item.description ?? null,
      url: item.link,
      urlToImage: null,
      publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : null,
      author: item.author ?? null,
      content: item.description ?? null,
      source: { id: feedUrl, name: new URL(feedUrl).hostname },
    }));
  });
}

export const RssProvider = { fetch: fetchFromRss, feeds: DEFAULT_FEEDS };