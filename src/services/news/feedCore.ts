// ORBIT — هسته‌ی پارس فید (بدون وابستگی به next/server)
// این ماژول هم توسط route پروکسی (/api/rss) و هم مستقیماً توسط feeds.server.ts
// استفاده می‌شود تا کش سمت سرور حتی در dev و self-host هم فعال بماند.

export interface RssItem {
  title: string;
  link: string;
  description?: string;
  pubDate?: string;
  author?: string;
  /** News image URL (from media:thumbnail / enclosure / first <img> in description) */
  imageUrl?: string;
  /** Main article page's image link — fallback when the feed lacks images (TechCrunch etc.) */
  pageImageUrl?: string;
  /**
   * FIX — آمار نادرست داشبورد/آنالیتیکس: مقالات دستی ادمین از همین تایپ
   * عبور می‌کنند؛ category تا پیش از این دور ریخته می‌شد و ویجت دسته‌ها و
   * نمودار مقایسه، هرگز مقاله دستی را نمی‌شمردند.
   */
  category?: string | null;
  /** فقط خواندنی — منتشرشده بودن؛ مصرف‌کننده loopback قبلاً این را هم دور می‌ریخت */
  isPublished?: boolean;
}

export type FeedPayload = { items?: RssItem[]; error?: string; status: number };

/** Allowed feed domains — any other url is rejected (SSRF guard) */
export const ALLOWED_FEED_HOSTS = new Set([
  'feeds.arstechnica.com',
  'www.theverge.com',
  'techcrunch.com',
  'www.wired.com',
  'www.nasa.gov',
  'feeds.bbci.co.uk',
  'www.theguardian.com',
]);

export const FETCH_TIMEOUT = 8000;

/** Browser User-Agent — some sites (e.g. TechCrunch) 403 robot UAs */
export const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

/** Strip tags and CDATA for clean text */
export function stripTags(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#038;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function decodeEntities(s: string): string {
  // FIX (سخت‌سازی ورودی مخرب فید): نسخه قبلی هر کدpoint را بدون کران به
  // String.fromCharCode می‌داد؛ ورودیهای &#999999999; کاراکترهای بیرون از
  // محدوده Unicode/کنترلی تولید می‌کردند که در URL/alt به UI نشت می‌کند.
  // حالا فقط نقاط مجاز (<0x10FFFF و غیرسورارات) پذیرفته می‌شوند؛ بقیه حذف.
  return s
    .replace(/&#(\d+);/g, (_, n) => safeCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeCodePoint(parseInt(h, 16)));
}

function safeCodePoint(cp: number): string {
  if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) return '';
  // سورارات UTF-16 و کنترل‌کاراکترهای C0 (به‌جز tab/newline) حذف می‌شوند
  if ((cp >= 0xd800 && cp <= 0xdfff) || (cp < 0x20 && cp !== 0x09 && cp !== 0x0a && cp !== 0x0d)) return '';
  return String.fromCodePoint(cp);
}

/** Image URL validation: http(s) only */
export function safeImageUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const url = decodeEntities(raw.trim());
  if (!/^https?:\/\//i.test(url)) return undefined;
  // Explicitly reject icons/small spacers and video embeds (NASA media:content YouTube embeds)
  if (/youtube\.com\/embed|player\.vimeo/i.test(url)) return undefined;
  return url;
}

/** Pick the best media:thumbnail/content among candidates — prefer larger, wide-aspect images */
export function bestMediaImage(block: string): string | undefined {
  const re = /<media:(?:thumbnail|content)\b([^>]*)\/?>/gi;
  let m: RegExpExecArray | null;
  let best: { url: string; score: number } | undefined;

  while ((m = re.exec(block))) {
    const attrs = m[1];
    const urlRaw = /\burl="([^"]+)"/.exec(attrs)?.[1] ?? /\burl='([^']+)'/.exec(attrs)?.[1];
    const url = safeImageUrl(urlRaw ?? undefined);
    if (!url) continue;

    const type = /\btype="([^"]*)"/.exec(attrs)?.[1] ?? '';
    if (type && !/^image\//i.test(type)) continue; // reject video/audio

    const w = Number(/\bwidth="(\d+)"/.exec(attrs)?.[1] ?? 0);
    const h = Number(/\bheight="(\d+)"/.exec(attrs)?.[1] ?? 0);
    // Scoring: bigger dimensions win; wide images (aspect~16:9) are ideal for news cards
    const area = w * h;
    const wideBonus = w >= 500 ? 2_000_000 : 0;
    const score = area + wideBonus;

    if (!best || score > best.score) best = { url, score };
  }
  return best?.url;
}

/** Extract image from an <item> block: media:content/thumbnail -> enclosure -> first description <img> */
export function extractImage(block: string, description: string | undefined): string | undefined {
  // 1) Best media:thumbnail / media:image (Ars/BBC/Wired/NASA/Guardian)
  const fromMedia = bestMediaImage(block);
  if (fromMedia) return fromMedia;

  // 2) Enclosure with an image type
  const enc =
    /<enclosure[^>]*type="image[^"]*"[^>]*url="([^"]+)"/i.exec(block)?.[1] ??
    /<enclosure[^>]*url="([^"]+)"[^>]*type="image/i.exec(block)?.[1];
  const fromEnc = safeImageUrl(enc);
  if (fromEnc) return fromEnc;

  // 3) First <img> inside description/content (The Verge and Atom content-html)
  const img =
    /<img[^>]*\bsrc="([^"]+)"/i.exec(description ?? '')?.[1] ??
    /<img[^>]*\bsrc='([^']+)'/i.exec(description ?? '')?.[1];
  return safeImageUrl(img);
}

/*
 * PERF — پیکربندی ثابت pickTag کش می‌شود: قبلاً برای هر آیتم تا ~۱۰ بار
 * `new RegExp(...)` ساخته می‌شد (۴۰ آیتم × چند تگ = صدها Regex در هر پارس).
 * الگوی کامپایل‌شده per-tag یک‌بار ساخته و بازاستفاده می‌شود؛ regex بدون
 * flag /g بودنی است (بدون lastIndex) پس اشتراک‌گذاری بی‌خطر است.
 */
const pickTagPatternCache = new Map<string, RegExp>();

export function pickTag(block: string, tag: string): string | undefined {
  let re = pickTagPatternCache.get(tag);
  if (!re) {
    re = new RegExp(
      `<${tag}[^>]*(?:/>|>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>)`,
      'i'
    );
    pickTagPatternCache.set(tag, re);
  }
  const m = re.exec(block);
  return m?.[1]?.trim();
}

/** Supports RSS 2.0 (<item>) and Atom (<entry>) */
export function parseFeed(xml: string): RssItem[] {
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  const atomBlocks = blocks.length ? [] : (xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? []);
  const all = [...blocks, ...atomBlocks];

  const items: RssItem[] = [];
  for (const block of all.slice(0, 40)) {
    const title = pickTag(block, 'title');
    // Atom: <link href="..."/> vs RSS: <link>url</link>
    const link =
      pickTag(block, 'link') ??
      /<link[^>]*\bhref="([^"]+)"[^>]*\/?>/i.exec(block)?.[1];
    if (!title || !link) continue;

    const descriptionRaw =
      pickTag(block, 'description') ??
      pickTag(block, 'content') ??
      pickTag(block, 'summary') ??
      pickTag(block, 'content:encoded');

    const plainDescription = descriptionRaw ? stripTags(descriptionRaw).slice(0, 500) : undefined;

    items.push({
      title: stripTags(title).slice(0, 300),
      link: decodeEntities(link.trim()),
      description: plainDescription || undefined,
      pubDate: pickTag(block, 'pubDate') ?? pickTag(block, 'published') ?? pickTag(block, 'updated'),
      // FIX — "<![CDATA[BBC]]>" rendered as author: dc:creator came out of the feed
      // without stripTags. Now CDATA/tags are cleaned and the length is clamped.
      author: (() => {
        const rawAuthor =
          pickTag(block, 'author') ??
          /<dc:creator>([\s\S]*?)<\/dc:creator>/i.exec(block)?.[1]?.trim() ??
          /<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/i.exec(block)?.[1]?.trim();
        return rawAuthor ? stripTags(rawAuthor).slice(0, 120) || undefined : undefined;
      })(),
      imageUrl: extractImage(block, descriptionRaw),
    });
  }
  return items;
}

/** Extract og:image / twitter:image from the article page HTML (fallback for feeds like TechCrunch) */
export function extractOgImage(html: string): string | undefined {
  const patterns = [
    /<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i,
    /<meta[^>]*content="([^"]+)"[^>]*property="og:image"/i,
    /<meta[^>]*name="twitter:image"[^>]*content="([^"]+)"/i,
    /<meta[^>]*content="([^"]+)"[^>]*name="twitter:image"/i,
  ];
  for (const re of patterns) {
    const url = safeImageUrl(re.exec(html)?.[1]);
    if (url) return url;
  }
  return undefined;
}

/**
 * FIX — باگ لاجیکی: enrichMissingImages نتیجه را روی item.pageImageUrl می‌نشاند،
 * اما parseFeed بعداً همان آیتم‌ها را با spread می‌سازد و این فیلد هرگز کپی
 * نمی‌شد → تمام effort غنی‌سازی (تا ۸ fetch HTML) دور ریخته می‌شد و کارت‌های
 * TechCrunch/Verge بدون تصویر می‌ماندند. حالا مقدار اولیه از بلوک اصلی
 * حفظ/ادغام می‌شود.
 */
export function mergeEnriched(base: RssItem, enriched: RssItem): RssItem {
  return { ...base, ...enriched, pageImageUrl: enriched.pageImageUrl ?? base.pageImageUrl };
}

/**
 * SECURITY — محافظ DNS-rebinding/redirect:
 * پس از هر ریدایرکت، هاست نهایی باید همچنان در لیست دامنه‌های مجاز باشد؛
 * در غیر این صورت پاسخ «ممنوع» برمی‌گردد و بدنه خوانده نمی‌شود.
 * FIX (تعارض allowlist): علاوه بر ایستی‌های کد، هاست‌های ثبت‌شده و فعال در
 * جدول feed_sources هم مجازند — قبلاً ادمین می‌توانست فید جدید اضافه کند ولی
 * همان فید در sync/preview با feed_403 رد می‌شد. منبع حقیقت یکی شد.
 * کوئری DB به‌صورت best-effort و fail-closed: خطا → فقط ایستی‌های کد.
 */
let dbHostsCache: Set<string> | null = null;
let dbHostsCachedAt = 0;
const DB_HOSTS_TTL_MS = 60_000;

async function getDbFeedHosts(forceRefresh = false): Promise<Set<string>> {
  const now = Date.now();
  // FIX (SECURITY/SSRF): نسخه قبلی حتی پس از فراخوانی clearFeedPrefetchCache
  // (مثلاً وقتی ادمین یک فید را حذف می‌کند) کش DB هاست‌ها را تا پایان TTL نگه
  // می‌داشت؛ یعنی هاستِ حذف‌شده همچنان در assertAllowedHost مسیر ریدایرکت
  // مجاز بود و داده قدیمی آن به کاربران سرو می‌شد. حالا با پرچم force می‌توان
  // کش را بی‌اعتبار کرد و membership همیشه از تازه‌ترین snapshot خوانده می‌شود.
  if (!forceRefresh && dbHostsCache && now - dbHostsCachedAt < DB_HOSTS_TTL_MS) return dbHostsCache;
  try {
    // lazy import تا @supabase/ssr وارد باندل مسیرهای عمومی نگردد (الگوی serverClient).
    const { createClient } = await import('@supabase/supabase-js');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      '';
    if (!url || !key) return new Set();
    const supa = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data } = await supa.from('feed_sources').select('url').eq('enabled', true).limit(200);
    const hosts = new Set<string>();
    for (const row of data ?? []) {
      try {
        hosts.add(new URL(String(row.url)).hostname);
      } catch {
        /* rows with malformed url are ignored */
      }
    }
    dbHostsCache = hosts;
    dbHostsCachedAt = now;
    return hosts;
  } catch {
    return new Set();
  }
}

export async function isFeedHostAllowed(host: string): Promise<boolean> {
  if (ALLOWED_FEED_HOSTS.has(host)) return true;
  const db = await getDbFeedHosts();
  return db.has(host);
}

/**
 * FIX (SECURITY/SSRF): پس از تغییر فیدها در پنل ادمین (افزودن/حذف/غیرفعال
 * کردن) یا فراخوانی clearFeedPrefetchCache، کش هاستهای مجاز باید فوراً
 * بی‌اعتبار شود؛ وگرنه هاست حذف‌شده تا TTL همچنان در مسیر ریدایرکت پذیرفته
 * می‌شود. fail-closed: snapshot بعدی از DB بازسازی می‌شود.
 */
export function invalidateFeedHostsCache(): void {
  dbHostsCache = null;
  dbHostsCachedAt = 0;
}

function assertAllowedHost(finalUrl: string, label: string): void {
  const host = new URL(finalUrl).hostname;
  // چک همزمان: ایستی‌های کد بلافاصله؛ برای بقیه، membership در کش DB (سینک).
  // اگر کش هنوز ساخته نشده، ریدایرکت به هاست غریبه مسدود می‌ماند (fail-closed).
  const allowed = ALLOWED_FEED_HOSTS.has(host) || (dbHostsCache?.has(host) ?? false);
  if (!allowed) {
    throw new Error(`${label}: redirect to disallowed host "${host}" blocked`);
  }
}

export async function enrichMissingImages(items: RssItem[]): Promise<void> {
  const missing = items.filter((it) => !it.imageUrl && /^https?:\/\//i.test(it.link));
  // Cap of 8 requests so proxy latency does not explode
  const batch = missing.slice(0, 8);
  await Promise.allSettled(
    batch.map(async (item) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(item.link, {
          signal: controller.signal,
          headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html,*/*' },
          cache: 'no-store',
          // Manual follow so the final host is checked before reading the body
          redirect: 'manual',
        });
        let target = item.link;
        let response = res;
        for (let hop = 0; hop < 3 && response.status >= 300 && response.status < 400; hop++) {
          const loc = response.headers.get('location');
          if (!loc) return;
          target = new URL(loc, target).toString();
          assertAllowedHost(target, 'og:image fetch');
          response = await fetch(target, {
            signal: controller.signal,
            headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html,*/*' },
            cache: 'no-store',
            redirect: 'manual',
          });
        }
        if (!response.ok) return;
        assertAllowedHost(response.url || target, 'og:image fetch');
        // Read only the head/first chunk of the page — og:image usually lives in <head>
        const text = (await response.text()).slice(0, 60_000);
        const img = extractOgImage(text);
        if (img) item.pageImageUrl = img;
      } catch {
        // Blocked host or network error -> skip silently (an image-less feed beats failing the whole request)
      } finally {
        clearTimeout(timer);
      }
    }),
  );
}

/**
 * بدنه‌ی کارِ واقعی: fetch فید + پارس + غنی‌سازی og:image.
 * خودش کش‌نشدنی است تا در حالت background revalidation (SWR) حتماً داده تازه بگیرد.
 */
export async function fetchFeedWork(url: string): Promise<FeedPayload> {
  // SSRF guard: allowlisted domains only (before any fetch)
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return { error: 'Invalid url parameter.', status: 400 };
  }
  if (target.protocol !== 'https:' && target.protocol !== 'http:') {
    return { error: 'Only https is allowed.', status: 400 };
  }
  // FIX (تعارض allowlist): ایستی‌های کد + هاست‌های فعال feed_sources (کش DB).
  if (!(await isFeedHostAllowed(target.hostname))) {
    return { error: 'This domain is not allowed.', status: 403 };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const res = await fetch(target.toString(), {
      signal: controller.signal,
      headers: { 'User-Agent': BROWSER_UA, Accept: 'application/rss+xml, application/xml, text/xml, */*' },
      cache: 'no-store',
      redirect: 'manual',
    });

    // SECURITY: feed redirects followed only to allowed domains (max 3 hops)
    let finalRes = res;
    let current = target.toString();
    for (let hop = 0; hop < 3 && finalRes.status >= 300 && finalRes.status < 400; hop++) {
      const loc = finalRes.headers.get('location');
      if (!loc) break;
      current = new URL(loc, current).toString();
      assertAllowedHost(current, 'feed fetch');
      finalRes = await fetch(current, {
        signal: controller.signal,
        headers: { 'User-Agent': BROWSER_UA, Accept: 'application/rss+xml, application/xml, text/xml, */*' },
        cache: 'no-store',
        redirect: 'manual',
      });
    }

    if (!finalRes.ok) {
      return { error: `Invalid feed response (${finalRes.status})`, status: 502 };
    }

    const xml = await finalRes.text();
    const items = parseFeed(xml);

    // FIX — image-less news: pull the article page's og:image for items whose feed lacks one
    await enrichMissingImages(items);

    // FIX — باگ pageImageUrl: آیتم‌های غنی‌شده باید دوباره از parseFeed عبور
    // کنند تا فیلد pageImageUrl در خروجی بماند (parseFeed آن را کپی نمی‌کرد).
    // راه‌حل ارزان: همان آیتم‌ها را با mergeEnriched روی نسخه پارس‌شده بنویس.
    const enrichedByIdentity = new Map<string, RssItem>();
    for (const it of items) if (it.pageImageUrl) enrichedByIdentity.set(it.link, it);
    const finalItems = enrichedByIdentity.size > 0
      ? items.map((it) => {
          const e = enrichedByIdentity.get(it.link);
          return e ? mergeEnriched(it, e) : it;
        })
      : items;

    return { items: finalItems, status: 200 };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    // Do not leak internal messages (e.g. blocked host) to the client
    if (msg.includes('disallowed')) return { error: 'This domain is not allowed.', status: 403 };
    return { error: `Feed fetch failed: ${msg}`, status: 502 };
  } finally {
    clearTimeout(timer);
  }
}
