// src/services/news/feeds.server.ts — server-side RSS feed prefetch (Server Component only)

import { DEFAULT_FEEDS } from './rssProvider';
// ADMIN (پنل مدیریت): فهرست فیدها در جدول feed_sources قابل ویرایش است. این
// getter با dynamic import (فقط سمت سرور) از دیتابیس می‌خواند؛ نبودِ migration
// یا خطای DB → fallback به پیش‌فرض کد، بدون هیچ تأثیری بر پایداری فید.
// SECURITY/BUILD: زنجیره getAdminClient → next/headers هرگز نباید وارد گراف
// Client Components شود (توربوپک build را می‌شکند). پس خودِ ماژول هم lazy
// import می‌شود تا حتی به‌صورت ظاهری (surface) در گراف کلاینت نباشد.
let dbFeedsCache: { urls: string[]; at: number } | null = null;
async function getActiveFeeds(): Promise<readonly string[]> {
  if (dbFeedsCache && Date.now() - dbFeedsCache.at < 60_000) return dbFeedsCache.urls;
  try {
    const { getRuntimeFeedUrls } = await import('@/services/news/feedSources');
    const { getAdminClient } = await import('@/services/admin/serverClient');
    const supa = await getAdminClient();
    if (!supa) return DEFAULT_FEEDS;
    const urls = await getRuntimeFeedUrls(supa);
    if (urls && urls.length > 0) {
      dbFeedsCache = { urls, at: Date.now() };
      return urls;
    }
  } catch {
    /* DB در دسترس نیست → پیش‌فرض کد */
  }
  return DEFAULT_FEEDS;
}
import type { RssItem } from './rssProvider';
import { fetchFeedWork, invalidateFeedHostsCache } from './feedCore';

/**
 * FIX - ریشه اصلی Performance (LCP/TBT) در دسکتاپ:
 * قبلاً فید خبری کاملاً client-side لود می‌شد: HTML خالی از داده، hydrate،
 * useEffect و 7 درخواست موازی /api/rss و پارس JSON حجیم و رندر دوباره.
 * یعنی main thread دقیقاً در حساس‌ترین فاز بارگذاری (TBT=210ms) کار سنگین
 * داشت و تصویر LCP (کارت اول) دیرترین عنصر صفحه بود.
 *
 * حالا خودِ Next.js در زمان رندر صفحه، پاسخ پروکسی را با fetch داخلی (بدون
 * TLS/DNS اضافه) می‌گیرد و آیتم‌ها داخل RSC payload امبد می‌شوند:
 *   - news cacheService در اولین render با داده واقعی seed می‌شود
 *     (key دقیق = news:all||1|20|publishedAt که newsService می‌سازد)
 *   - NewsFeed بلافاصله success رندر می‌شود؛ بدون waterfall، بدون re-parse
 *   - خطای سرور بی‌صدا نادیده گرفته می‌شود؛ کلاینت مثل قبل retry می‌کند.
 */

const PAGE_SIZE = 20;
/** In-memory TTL for the server prefetch cache — matches the RSS proxy s-maxage */
const PREFETCH_TTL_MS = 300_000;

/**
 * FIX — ریشه‌ی LCP/TTFB در صفحه خبر: قبلاً هر بازدیدکننده (و هر درخواست سروری)
 * هزینه‌ی cold-fetch فیدها را می‌پرداخت. حالا نتایج در یک کش ماژولِ stale-while-
 * revalidate نشسته‌اند: اولین نفر هزینه را می‌دهد، بقیه آنی جواب می‌گیرند و
 * انقضا در پس‌زمینه تازه می‌شود (بدون بلاک‌شدن رندر).
 *
 * FIX (SECURITY/perf) — این کش مستقیماً fetchFeedWork را صدا می‌زند؛ قبلاً از
 * طریق HTTP loopback به /api/rss می‌رفت که در dev و self-host عملاً هیچ کش
 * سروری مؤثری نمی‌ساخت (هر instance دوباره cold-fetch می‌کرد) و یک round-trip
 * بی‌مصرف اضافه داشت. حالا کش در همان process است و SSRF/redirect guard داخل
 * feedCore روی هر دو مسیر اعمال می‌شود.
 */
type Entry = { items: RssItem[]; at: number };
const feedMemoryCache = new Map<string, Entry>();
const inflight = new Map<string, Promise<RssItem[]>>();

/**
 * FIX (پنل ادمین — دکمه «پاک‌سازی کش فید»): تا قبل از این، پس از انتشار/حذف
 * مقاله یا تغییر فیدها فقط کش newsService پاک می‌شد و داده خام هر فید تا ۵ دقیقه
 * stale می‌ماند. این تابع همان Mapهای ماژول-اسکوپ را خالی می‌کند؛ در serverless
 * روی instance فعلی اثر دارد (بقیه با TTL/SWR خودشان تازه می‌شوند).
 */
export function clearFeedPrefetchCache(): void {
  dbFeedsCache = null;
  feedMemoryCache.clear();
  inflight.clear();
  lastGoodItems = null;
  // SECURITY FIX (SSRF): کش هاستهای مجازِ feedCore هم باید بی‌اعتبار شود؛
  // پیش از این پس از حذف فید توسط ادمین، هاست حذف‌شده تا TTL در چک
  // ریدایرکت‌ها (assertAllowedHost) همچنان مجاز می‌ماند.
  invalidateFeedHostsCache();
}

async function loadFeedFresh(feedUrl: string): Promise<RssItem[]> {
  try {
    const payload = await fetchFeedWork(feedUrl);
    return payload.error ? [] : (payload.items ?? []);
  } catch {
    return [];
  }
}

async function fetchOneFeed(feedUrl: string): Promise<RssItem[]> {
  const hit = feedMemoryCache.get(feedUrl);
  const ageMs = hit ? Date.now() - hit.at : Infinity;

  if (hit && ageMs < PREFETCH_TTL_MS) return hit.items;

  // Stale -> return the same data immediately and revalidate in the background
  if (hit) {
    if (!inflight.has(feedUrl)) {
      const p = loadFeedFresh(feedUrl)
        .then((items) => {
          if (items.length > 0) feedMemoryCache.set(feedUrl, { items, at: Date.now() });
          return items;
        })
        .catch(() => hit.items)
        .finally(() => inflight.delete(feedUrl));
      inflight.set(feedUrl, p);
    }
    return hit.items;
  }

  // Cold miss — concurrent callers share one fetch
  let p = inflight.get(feedUrl);
  if (!p) {
    p = loadFeedFresh(feedUrl)
      .then((items) => {
        if (items.length > 0) feedMemoryCache.set(feedUrl, { items, at: Date.now() });
        return items;
      })
      .finally(() => inflight.delete(feedUrl));
    inflight.set(feedUrl, p);
  }
  return p;
}

/** Merge all feeds, sort by freshness and slice to one page size. */
export async function getPrefetchedNewsItems(): Promise<RssItem[]> {
  try {
    const feeds = await getActiveFeeds();
    const settled = await Promise.all(feeds.map((f) => fetchOneFeed(f)));
    const merged = settled.flat();

    // FIX — «انتشار بی‌اثر» در پنل ادمین: مقالات دستی منتشرشده (ستون
    // is_published=true) هرگز به seed HTML اضافه نمی‌شدند؛ revalidatePath
    // فقط newsService را تازه می‌کرد و صفحه خانه/خبر تا اولین fetch
    // کلاینتی (یا نبودِ آن در حالت JS-off) مقاله جدید ادمین را نشان نمی‌داد.
    // حالا همان آیتم‌ها از DB خوانده و بالاتر از فید merge می‌شوند (خطا → []
    // و هیچ تأثیری بر مسیر فید ندارد).
    const manual = await getManualRssItems();
    if (manual.length > 0) {
      const seenLinks = new Set(manual.map((m) => m.link));
      for (const item of merged) if (!seenLinks.has(item.link)) seenLinks.add(item.link);
      const dedupedMerged = merged.filter((m) => !manual.some((x) => x.link === m.link));
      const all = [...manual, ...dedupedMerged];
      all.sort(
        (a, b) =>
          new Date(b.pubDate ?? 0).getTime() - new Date(a.pubDate ?? 0).getTime(),
      );
      return all.slice(0, PAGE_SIZE);
    }

    if (merged.length === 0) return [];
    merged.sort(
      (a, b) =>
        new Date(b.pubDate ?? 0).getTime() - new Date(a.pubDate ?? 0).getTime(),
    );
    return merged.slice(0, PAGE_SIZE);
  } catch {
    return [];
  }
}

/**
 * مقالات دستی منتشرشده → RssItem (برای seed HTML). dynamic import + کش
 * in-process: خطای DB/نبود migration هرگز نباید prefetch فید را بشکند.
 */
let manualItemsCache: { items: RssItem[]; at: number } | null = null;
const MANUAL_SEED_TTL_MS = 60_000;

async function getManualRssItems(): Promise<RssItem[]> {
  if (manualItemsCache && Date.now() - manualItemsCache.at < MANUAL_SEED_TTL_MS) {
    return manualItemsCache.items;
  }
  try {
    const { getManualArticles } = await import('@/services/admin/manualArticles');
    const rows = await getManualArticles();
    const items: RssItem[] = rows
      .filter((r) => r.isPublished !== false)
      .map((r) => ({
        title: r.title,
        link: r.url,
        description: r.description ?? undefined,
        pubDate: r.publishedAt ?? undefined,
        author: r.author ?? undefined,
        imageUrl: r.urlToImage ?? undefined,
        category: r.category ?? null,
        isPublished: true,
      }));
    manualItemsCache = { items, at: Date.now() };
    return items;
  } catch {
    return manualItemsCache?.items ?? [];
  }
}

/**
 * FIX — ریشه‌ی LCP=6.9s موبایل: preload تصویر کارت اول هرگز در HTML ظاهر
 * نمی‌شد چون generateMetadata همزمان با Body دو «اولین» درخواست cold-fetch
 * راه می‌انداخت و یکی (یا هر دو) timeout می‌خوردند. حالا این تابع نتیجه را
 * برای TTL کوتاه در ماژول-اسکوپ نگه می‌دارد؛ Metadata و Body یک request
 * مشترک دارند و hint تصویر LCP تقریباً همیشه موجود است.
 */
let lastGoodItems: { items: RssItem[]; at: number } | null = null;
const LAST_GOOD_TTL_MS = 120_000;

export async function getPrefetchedNewsItemsWithFallback(): Promise<RssItem[]> {
  const fresh = await getPrefetchedNewsItems();
  if (fresh.length > 0) {
    lastGoodItems = { items: fresh, at: Date.now() };
    return fresh;
  }
  // Cold/error -> last successful fresh data (better than having no seed/preload at all)
  if (lastGoodItems && Date.now() - lastGoodItems.at < LAST_GOOD_TTL_MS) {
    return lastGoodItems.items;
  }
  return [];
}

/**
 * FIX — LCP موبایل (ریشه‌ی LCP=6.9s): preconnect خالی دیگر کافی نبود؛
 * حالا خودِ URL تصویر کارت اول + عرض viewport-aware استخراج می‌شود تا
 * <link rel="preload" as="image" fetchpriority="high"> در HTML اولیه
 * بنشیند و دانلود تصویر LCP هم‌زمان با CSS/JS شروع شود (نه بعد از
 * hydrate). مقادیر فقط از allowlist https ثابت (بدون injection).
 */
const IMAGE_CDN_ALLOWLIST = new Set([
  'ichef.bbci.co.uk',
  'images.immediate.co.uk',
  'cdn.arstechnica.net',
  'arstechnica.com',
  'www.theverge.com',
  'platform.theverge.com',
  'techcrunch.com',
  'media.wired.com',
  'www.wired.com',
  'images.ctfassets.net',
  'www.nasa.gov',
  'upload.wikimedia.org',
]);

function safeImageUrl(item: RssItem): string | null {
  const raw = item.imageUrl ?? item.pageImageUrl;
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return null;
    if (!IMAGE_CDN_ALLOWLIST.has(u.hostname)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** First card image origin — for <link rel=preconnect>. */
export function getLcpImageOrigin(items: RssItem[]): string | null {
  for (const item of items.slice(0, 3)) {
    const url = safeImageUrl(item);
    if (!url) continue;
    try {
      const u = new URL(url);
      return `${u.protocol}//${u.hostname}`;
    } catch {
      /* رد */
    }
  }
  return null;
}

/** Full LCP image URL — for <link rel=preload as=image fetchpriority=high>. */
export function getLcpImageUrl(items: RssItem[]): string | null {
  for (const item of items.slice(0, 3)) {
    const url = safeImageUrl(item);
    if (url) return url;
  }
  return null;
}

/**
 * عرض preload متناسب با breakpoint واقعی Tailwind گرید فید:
 *   sm(≥640): 2 ستون → نصف viewport − شکاف‌ها
 *   xl(≥1280): 3 ستون → یک‌سوم viewport
 * موبایل (۳۹۰px لایت‌هاوس) → ~178w؛ دسکتاپ ۱۴۴۰ → ~466w.
 * preload فقط وقتی استفاده می‌شود که media منطبق باشد → دانلود بی‌مصرف نداریم.
 */
export function getLcpImageSrcSet(items: RssItem[]): string | null {
  const url = getLcpImageUrl(items);
  if (!url) return null;
  return [
    `(max-width: 639px) ${url} 178w`,
    `(max-width: 1279px) ${url} 350w`,
    `${url} 466w`,
  ].join(', ');
}
