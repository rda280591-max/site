// ORBIT — RSS provider
import { ENDPOINTS } from '@/core/config';
import { Result, Ok, Err, tryCatch } from '@/core/result';
import { NetworkError } from '@/core/errors';
import { createLogger } from '@/core/logger';
import { get } from '@/services/http/client';
import { pick } from '@/services/http/interceptors';
import type { RawNewsApiArticle } from '@/services/http/interceptors';

const log = createLogger('services.news.rss');

export const DEFAULT_FEEDS = [
  'https://feeds.arstechnica.com/arstechnica/index',
  'https://www.theverge.com/rss/index.xml',
  'https://techcrunch.com/feed/',
  'https://www.wired.com/feed/rss',
  'https://www.nasa.gov/feed/',
  // FIX — image-rich feeds: BBC and Guardian ship nearly every item with an image
  'https://feeds.bbci.co.uk/news/technology/rss.xml',
  'https://www.theguardian.com/technology/rss',
] as const;

/** Shared-type source of truth: feedCore (between the proxy route and server prefetch) */
export type { RssItem } from './feedCore';
import type { RssItem } from './feedCore';

/** Several specialized feeds + general ones — for news variety and better categorization */
export const ALL_FEEDS = [...DEFAULT_FEEDS] as string[];

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
      // FIX: قبلاً همیشه null بود → هیچ کارتی عکس نداشت. حالا از پروکسی RSS می‌آید.
      // fallback دوم: og:image صفحه خبر (برای فیدهایی مثل TechCrunch که در feed تصویر ندارند)
      urlToImage: item.imageUrl ?? item.pageImageUrl ?? null,
      publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : null,
      author: item.author ?? null,
      content: item.description ?? null,
      source: { id: feedUrl, name: new URL(feedUrl).hostname },
    }));
  });
}

/** Fetch several feeds concurrently and merge results (one feed's failure does not spoil the rest) */
export async function fetchAllFeeds(): Promise<Result<RawNewsApiArticle[]>> {
  const settled = await Promise.allSettled(ALL_FEEDS.map((f) => fetchFromRss(f)));
  const merged: RawNewsApiArticle[] = [];
  for (const r of settled) {
    if (r.status === 'fulfilled' && r.value.ok) merged.push(...r.value.value);
  }
  if (merged.length === 0) {
    return Err(new NetworkError('All RSS feeds failed.'));
  }
  // Newest first
  merged.sort((a, b) => new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime());
  log.info(`دریافت ${merged.length} خبر واقعی از ${settled.filter((r) => r.status === 'fulfilled').length} فید RSS`);
  return Ok(merged);
}

export const RssProvider = { fetch: fetchFromRss, feeds: DEFAULT_FEEDS };