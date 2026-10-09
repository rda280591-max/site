// src/app/api/rss/route.ts — پروکسی امن فیدهای RSS + استخراج تصویر بند‌انگشتی
// SECURITY: کل منطق fetch/پارس در feedCore.ts است که SSRF (سفیدلیست دامنه)،
// محدودیت ریدایرکت و سقف حجم خواندن را اعمال می‌کند. این فایل فقط لایه HTTP است.
import { NextRequest, NextResponse } from 'next/server';
import { isFeedHostAllowed, fetchFeedWork, type FeedPayload } from '@/services/news/feedCore';
import { createRateLimiter, ipKey, tooManyResponse } from '@/core/rateLimit';

// SECURITY (فاز ۲ — Rate Limit): پروکسی فید بدون محدودیت، ابزار رایگان برای
// تورتهای پرحجم و اسکن دامنه بود. IP-based: 60 درخواست/دقیقه؛ کش SWR پایین را
// عمداً باز می‌گذاریم تا کاربران عادی هرگز به سقف نرسند.
const rssLimiter = createRateLimiter(60, 60);

const FEED_CACHE_TTL_SECONDS = 300;

/**
 * In-memory stale-while-revalidate cache.
 * Root cause of the slow first paint on the news grid: every visitor used to
 * trigger a cold round-trip per feed (up to 8s + up to 8 og:image HTML
 * fetches). Now only the FIRST request per feed pays that cost; everyone else
 * gets an instant response, and expired entries are served stale while a
 * single background refresh runs. Works identically in dev, next start and
 * serverless (per-instance), and layers on top of the CDN s-maxage header.
 */
type CacheEntry = { payload: FeedPayload; at: number };
const feedCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<FeedPayload>>();

async function fetchCachedFeed(url: string): Promise<FeedPayload> {
  const now = Date.now();
  const hit = feedCache.get(url);

  if (hit) {
    const ageMs = now - hit.at;
    if (ageMs < FEED_CACHE_TTL_SECONDS * 1000) return hit.payload;

    // stale but within SWR window → serve stale, kick off one refresh
    if (ageMs < (FEED_CACHE_TTL_SECONDS + 600) * 1000 && !inflight.has(url)) {
      const p = fetchFeedWork(url)
        .then((payload) => {
          feedCache.set(url, { payload, at: Date.now() });
          return payload;
        })
        .catch(() => hit.payload)
        .finally(() => inflight.delete(url));
      inflight.set(url, p);
    }
    return hit.payload;
  }

  // cold miss — dedupe concurrent requests for the same feed
  let p = inflight.get(url);
  if (!p) {
    p = fetchFeedWork(url)
      .then((payload) => {
        feedCache.set(url, { payload, at: Date.now() });
        return payload;
      })
      .finally(() => inflight.delete(url));
    inflight.set(url, p);
  }
  return p;
}

export async function GET(req: NextRequest) {
  // SECURITY: origin check + throttle before any expensive work (external fetch)
  const secFetchSite = req.headers.get('sec-fetch-site');
  if (secFetchSite && !['same-origin', 'none'].includes(secFetchSite)) {
    return NextResponse.json({ error: 'cross-origin not allowed.' }, { status: 403 });
  }
  const rl = rssLimiter.check(ipKey(req));
  if (!rl.allowed) return tooManyResponse(rl.retryAfterSeconds);

  const url = req.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'Missing required parameter: url.' }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid url parameter.' }, { status: 400 });
  }

  if (parsed.protocol !== 'https:') {
    return NextResponse.json({ error: 'فقط https مجاز است.' }, { status: 400 });
  }
  // FIX (تعارض allowlist): چک از طریق feedCore انجام می‌شود تا ایستی‌های DB
  // (فیدهای تازه‌افزوده‌شده توسط ادمین) هم پذیرفته شوند؛ fetchFeedWork خودش
  // دوباره همین چک را دارد — اینجا فقط پاسخ HTTP زودتر می‌دهد.
  if (!(await isFeedHostAllowed(parsed.hostname))) {
    return NextResponse.json({ error: 'This domain is not allowed.' }, { status: 403 });
  }

  const payload = await fetchCachedFeed(parsed.toString());

  if (payload.error) {
    return NextResponse.json({ error: payload.error }, { status: payload.status });
  }

  return NextResponse.json(
    { items: payload.items },
    { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' } },
  );
}
