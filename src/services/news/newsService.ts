// ORBIT — news orchestrator
import type { NewsCategoryId } from '@/core/config';
import { Result, Ok, tryCatchSync } from '@/core/result';
import { createLogger } from '@/core/logger';
import { eventBus } from '@/core/eventBus';
import { cacheService } from '@/services/cache/cacheService';
import { NewsApiProvider } from './newsApi';
import { MockProvider } from './mockProvider';
// SECURITY/BUILD: ماژول admin/manualArticles (وابسته به next/headers) عمداً فقط
// به‌صورت dynamic import و صرفاً در محیط سرور بارگذاری می‌شود تا هرگز وارد
// باندل Client Components نگردد (وگرنه next build می‌شکند).
import { fetchAllFeeds } from './rssProvider';
import type { RssItem } from './rssProvider';
import { normalizeArticle, inferCategory, dedupeArticles } from './articleNormalizer';
import type { RawNewsApiArticle } from '@/services/http/interceptors';
import type { Article, NewsQuery, NewsResponse } from '@/types/news';

const log = createLogger('services.news');

/**
 * مقالات منتشرشده ادمین از طریق اندپوینت داخلی /api/articles.
 * عمداً HTTP (نه import مستقیم) — تا زنجیره next/headers هرگز وارد گراف
 * ماژول‌های مصرف‌شده توسط Client Components نشود (قانون build توربوپک).
 * فقط در سرور صدا زده می‌شود؛ خطا → آرایه خالی (فید RSS نباید بشکند).
 */
async function fetchServerArticles(): Promise<RssItem[]> {
  try {
    const port = process.env.PORT ?? '3000';
    const res = await fetch(`http://127.0.0.1:${port}/api/articles`, {
      // FIX — Performance: «next start» این هدرها را روی پاسخ /api/articles
      // اعمال می‌کند؛ با no-store هر request (و هر instance) هزینه کامل
      // دیتابیس را می‌پرداخت. حالا خودِ loopback هم از کش HTTP (s-maxage=300
      // + SWR) استفاده می‌کند → پاسخ آنی، بدون DB در حالت گرم.
      cache: 'default',
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { articles?: RssItem[] };
    return Array.isArray(json.articles) ? json.articles : [];
  } catch {
    return [];
  }
}

const MANUAL_TTL_MS = 300_000; // هم‌ارز s-maxage=300 در /api/articles
const MANUAL_CACHE_KEY = 'news:manualArticles';

/**
 * FIX — staleness/consistency: با نوشتن مقاله یا حذف آن توسط ادمین، علاوه بر
 * revalidatePath باید کش in-process هم پاک شود؛ وگرنه فید عمومی تا TTL کامل
 * (۵ دقیقه) داده قدیمی یا مقاله حذف‌شده را نشان می‌داد.
 *
 * FIX (BUILD) — این تابع دیگر feeds.server را dynamic import نمی‌کند:
 * newsService در گراف Client Components (state/newsStore → analytics) حضور دارد
 * و توربوپک حتی dynamic import را هم «surface» می‌کند؛ زنجیره
 * feeds.server → serverClient → next/headers باعث خطای build می‌شد. پاک‌سازی
 * prefetch فید حالا مستقیم از همان فراخوان‌کننده‌های سمت سرور (adminActions /
 * feedAdmin) انجام می‌شود که در گراف کلاینت نیستند.
 */
export function invalidateNewsCaches(): void {
  cacheService.invalidate(MANUAL_CACHE_KEY);
  cacheService.invalidatePrefix('news:');
}
/** Single-flight: همه فراخوانی‌های هم‌زمان یک promise مشترک را مصرف می‌کنند. */
let manualInflight: Promise<RssItem[]> | null = null;

async function getManualArticlesCached(): Promise<RssItem[]> {
  const cached = cacheService.get<RssItem[]>(MANUAL_CACHE_KEY);
  if (cached) return cached;
  if (!manualInflight) {
    manualInflight = fetchServerArticles()
      .then((items) => {
        cacheService.set(MANUAL_CACHE_KEY, items, MANUAL_TTL_MS);
        return items;
      })
      .finally(() => { manualInflight = null; });
  }
  return manualInflight;
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

/** برش صفحه از یک آرایه مرتب‌شده — O(pageSize) به‌جای نرمال‌سازی دوباره کل مجموعه. */
function paginateArticles(list: Article[], query: NewsQuery): Article[] {
  const size = Math.max(1, query.pageSize ?? 20);
  const page = Math.max(1, query.page ?? 1);
  return list.slice((page - 1) * size, page * size);
}

function matchesSearch(a: Article, term: string): boolean {
  const q = term.toLowerCase();
  return (
    a.title.toLowerCase().includes(q) ||
    (a.summary?.toLowerCase().includes(q) ?? false)
  );
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

  // FIX — Agentic Browsing / «داده‌ای موجود نیست» (۲/۳): آخرین fallback کل
  // فید، Mock بود؛ در production یعنی داده جعلی با عکس‌های picsum و
  // example.com به کاربر و ایجنت‌های AI سرو می‌شد. حالا mock فقط وقتی فعال
  // است که صریحاً درخواست شده (NEXT_PUBLIC_NEWS_MOCK=1 — توسعه آفلاین).
  // در غیر این صورت خطا صادقانه به UI می‌رسد و پنل «خطا + تلاش دوباره»
  // (به‌جای نمایش داده ساختگی) نشان داده می‌شود.
  const mockEnabled = process.env.NEXT_PUBLIC_NEWS_MOCK === '1';

  if (!raw.ok) {
    log.warn('NewsAPI ناموفق؛ تلاش با همه فیدهای RSS.');
    // FIX: previously only one feed (Ars Technica) was read; now all three feeds
    // merge concurrently -> more diverse news + real images.
    const rss = await fetchAllFeeds();
    if (rss.ok) {
      raw = Ok({ articles: rss.value, total: rss.value.length });
      provider = 'rss';
    } else if (mockEnabled) {
      log.warn('RSS نیز ناموفق؛ استفاده از Mock (فقط با NEXT_PUBLIC_NEWS_MOCK=1).');
      const mock = await MockProvider.fetch(query);
      raw = Ok(mock);
      provider = 'mock';
    } else {
      // هر دو منبع واقعی ناموفق → اگر نسخه stale در کش هست همان را بده،
      // وگرنه Err تا UI پیام خطای واقعی (و نه داده جعلی) نشان دهد.
      const stale = cacheService.getStale<NewsResponse>(key);
      if (stale && (stale.articles?.length ?? 0) > 0) {
        return Ok({ ...stale, fromCache: true });
      }
      // FIX — موبایل/ایجنتیک براوزینگ: مجموعه پایه نرمال‌شده هنوز در کش هست
      // ولی پاسخ query منقضی شده بود؛ از همان مجموعه برش بده (به‌جای خطا).
      const staleBase =
        cacheService.get<Article[]>('news:norm:base') ??
        cacheService.getStale<Article[]>('news:norm:base');
      if (staleBase && staleBase.length > 0) {
        provider = 'rss';
        // برش دسته از مجموعه پایه کهنه — منطق یکسان با sliceCategory پایین.
        const sliced =
          query.category === undefined || query.category === 'all'
            ? staleBase
            : staleBase.filter((a) => a.category === requestedCategory);
        const searched = query.search
          ? sliced.filter((a) => matchesSearch(a, query.search!))
          : sliced;
        return Ok({
          articles: paginateArticles(searched, query),
          total: searched.length,
          fromCache: true,
          provider,
        });
      }
      return raw;
    }
  }

  // FIX — Performance: قبلاً کل خروجی (ده‌ها تا ~100 مقاله، هرکدام با sanitize
  // و regex چندباره) برای هر query دوباره ساخته می‌شد. حالا نتیجه خام نرمال‌شده
  // در cacheService می‌نشیند و پاسخ‌های بعدی فقط برش صفحه (slice) هستند → O(pageSize).
  // FIX (آمار تکراری/فیلتر نشدن دسته): سه باگ واقعی این‌جا اصلاح شد —
  //  ۱) مسیر newsapi هرگز normalizeArticle نمی‌دید؛ مقالات خام بدون dedupe/sort
  //     و با total خام به کلاینت می‌رفتند.
  //  ۲) مجموعه نرمال‌شده ذیل کلید «دسته درخواست» کش می‌شد ولی از فیلتر category
  //     عبور نمی‌کرد → صفحه «هوش مصنوعی» عملاً همه اخبار را نشان می‌داد و متریک
  //     دسته‌های داشبورد بیش از تعداد واقعی جمع می‌شدند.
  // حالا یک «مجموعه پایه» نرمال‌شدهٔ کامل کش می‌شود و برای هر دسته فیلتر +
  // برش صفحه انجام می‌گیرد؛ total همیشه اندازه مجموعه واقعی همان دسته است.
  const normKey = `news:norm:${requestedCategory}`;
  const BASE_KEY = 'news:norm:base';

  /** برش جستجو+صفحه از یک مجموعه آماده و ساخت پاسخ. */
  function respondFrom(list: Article[], fromCache: boolean): NewsResponse {
    const searched = query.search
      ? list.filter((a) => matchesSearch(a, query.search!))
      : list;
    const response: NewsResponse = {
      articles: paginateArticles(searched, query),
      total: searched.length,
      fromCache,
      provider,
    };
    cacheService.set(key, response);
    return response;
  }

  /** فیلتر دسته از مجموعه پایه (query.category==='all' → بی‌فیلتر). */
  function sliceCategory(base: Article[]): Article[] {
    return query.category === undefined || query.category === 'all'
      ? base
      : base.filter((a) => a.category === requestedCategory);
  }

  const cachedNorm = cacheService.get<Article[]>(normKey);
  if (cachedNorm) {
    // جستجو روی مجموعه کش‌شده فیلتر می‌شود (کلاینت این مسیر را عملاً never-hit
    // دارد؛ newsStore قبل از fetch کش query را مصرف می‌کند).
    return Ok(respondFrom(cachedNorm, true));
  }

  // FIX — ادغام محتوای دستی ادمین با فید زنده از طریق HTTP کش‌شده.
  // SECURITY/BUILD: فراخوانی مستقیم ماژول admin (وابسته به next/headers) حتی به‌صورت
  // dynamic import باعث ورود آن به گراف Client Components و شکست Turbopack build می‌شد.
  // اکنون داده از مسیر /api/articles (فقط سمت سرور، با کش SWR) خوانده می‌شود؛
  // خطای شبکه نباید کل فید را بشکند → fallback به آرایه خالی.
  // FIX — Performance: قبلاً این await برای هر query (هر دسته/صفحه/جستجو) یک
  // loopback HTTP تازه راه می‌انداخت؛ حالا نتیجه در cacheService با TTL مشابه
  // هدرهای خودِ /api/articles (300s) کش می‌شود → در حالت گرم صفر درخواست شبکه.
  const manual = typeof window === 'undefined'
    ? await getManualArticlesCached()
    : [];

  // مجموعه پایه نرمال‌شده (مشترک بین همه دسته‌ها) — یک‌بار ساخته و کش می‌شود.
  let baseNormalized = cacheService.get<Article[]>(BASE_KEY);
  if (!baseNormalized) {
    const built = tryCatchSync(() => {
      const normalized = dedupeArticles(
        [
          ...manual.map((m) => m as unknown as RawNewsApiArticle),
          ...(raw.value.articles ?? []),
        ]
          .map((r) => normalizeArticle(r, inferCategory(r, requestedCategory)))
          .filter((a): a is Article => a !== null),
      );
      // FIX — Performance: مرت‌سازی newest-first یک‌بار همین‌جا (نه در هر query).
      normalized.sort((a, b) => b.publishedAt - a.publishedAt);
      return normalized;
    });
    // خطای نرمال‌سازی نباید کل فید را بشکند → مجموعه خالی (لاگ در Result).
    baseNormalized = built.ok ? built.value : [];
    cacheService.set(BASE_KEY, baseNormalized);
  }

  const forCategory = sliceCategory(baseNormalized);
  // FIX — Correctness: هرگز undefined کش نشود؛ اگر مجموعه پایه به هر دلیلی
  // خالی/ناخوانا بود، این کلید را ننویس تا query بعدی دوباره بسازد.
  if (forCategory) {
    cacheService.set(normKey, forCategory);
  }

  eventBus.emit('news:fetched', { count: forCategory.length, category: query.category });
  return Ok(respondFrom(forCategory, false));
}

// FIX — dead code removed: getArticleById had no consumers and looped over the
// local cache; the store/detail page use the existing articles.

export const newsService = { fetch: fetchNews };