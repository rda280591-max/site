// ORBIT — نرمال‌ساز مقالات (لایه مشترک سرور/کلاینت)
//
// چرا این فایل جداست؟ newsService به rssProvider → feeds.server وابسته است که
// زنجیره‌اش تا next/headers (Supabase server client) می‌رود؛ اگر کامپوننت
// کلاینتی مستقیم از newsService تابع خالص buildArticlesFromRssItems را import
// کند، کل آن زنجیره وارد باندل مرورگر شده و next build می‌شکند. این ماژول هیچ
// وابستگی سروری ندارد و برای هر دو طرف امن است.

import type { NewsCategoryId } from '@/core/config';
import { sanitizeText, truncate, stripToText } from '@/utils/sanitize';
import { uid } from '@/utils/formatters';
import { isValidArticle } from '@/utils/validators';
import { dedupeArticles } from '@/utils/dedupe';
import { parseDate } from '@/services/http/interceptors';
import type { RawNewsApiArticle } from '@/services/http/interceptors';
import type { Article } from '@/types/news';
import type { RssItem } from './feedCore';

/**
 * FIX — SSRF/blocklist-evasion: URLهای فیدها و ورودی ادمین فقط «https + regex
 * ساده» بررسی می‌شدند؛ hostname عددی دهدهی (decimal/octal/hex مانند
 * `https://1677721694` → 127.0.0.1، یا `https://0x7f.0.0.1`) از regex
 * `\d+\.\d+\.\d+\.\d+` رد می‌شد و لینک/تصویر به لوپ‌بک یا metadata سرویس‌ها
 * اشاره می‌کرد. حالا همه URLهای خروجی (article link + image) با پارسر واقعی
 * و blocklist کامل (loopback/private/link-local/CGNAT/metadata/IPv6) غربال
 * می‌شوند؛ مقدار نامعتبر → undefined (نه crash).
 */
const BLOCKED_HOST_RE = /^(localhost|.*\.localhost|\[::1\]|\[.*loopback.*\])$/i;

function isBlockedHostname(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, '');
  if (!h) return true;
  if (BLOCKED_HOST_RE.test(h)) return true;
  // IPv6 inside brackets: strip and basic loopback/ULA checks
  if (h.startsWith('[')) {
    const inner = h.slice(1, -1);
    if (inner === '::1' || inner === '' || inner === '::') return true;
    if (/^f[cd][0-9a-f]{2}:/i.test(inner) || /^fe80:/i.test(inner)) return true;
    // FIX (SSRF): دورزدن blocklist با فرم‌های ترکیبی IPv6 — مهاجم می‌تواند
    // [::ffff:127.0.0.1] یا [0:0:0:0:0:ffff:7f00:1] بدهد؛ پارسر URL آن را
    // هاست معتبر می‌گیرد ولی fetch به لوپ‌بک/متادیتا می‌زند. هر IPv6 که
    // بخشی از آن یک IPv4 (decimal یا hex segments) را کدگذاری می‌کند، باید
    // از همان فیلتر IPv4 عبور کند.
    // الف) پسوند dotted-v4: ::ffff:127.0.0.1 / ::10.0.0.1
    const v4Suffix = /:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(inner)?.[1];
    if (v4Suffix && isBlockedHostname(v4Suffix)) return true;
    // ب) دو سگمنت هگز آخر = یک IPv4: :ffff:7f00:1 → 127.0.0.1
    if (!inner.includes('.')) {
      const hexTail = /([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(inner);
      if (hexTail) {
        const hi = parseInt(hexTail[1], 16);
        const lo = parseInt(hexTail[2], 16);
        if (Number.isFinite(hi) && Number.isFinite(lo)) {
          const asV4 = `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
          if (isBlockedHostname(asV4)) return true;
        }
      }
    }
    // ج) ترانزیت IPv4-in-IPv6 بدون روتینگ مجاز روی سرور: Teredo (2001::/32)،
    //    6to4 (2002::/16) و NAT64 (64:ff9b::/96) همگی IPv4 مقصد را در خود
    //    encode می‌کنند و هیچ کاربرد مشروعی در فیدخوانی ندارند → مسدود.
    if (/^2001:/i.test(inner) || /^2002:/i.test(inner) || /^64:ff9b:/i.test(inner)) return true;
    return false;
  }
  // Numeric IPv4 in any radix (dotted-decimal, octal 0…, hex 0x…) collapses to ints
  const parts = h.split('.');
  if (parts.length <= 4 && parts.every((p) => /^\d+$/.test(p) || /^0x[0-9a-f]+$/i.test(p) || /^0[0-7]+$/.test(p))) {
    const nums = parts.map((p) => (/^0x/i.test(p) ? parseInt(p, 16) : /^0\d/.test(p) ? parseInt(p, 8) : Number(p)));
    if (nums.some((n) => Number.isNaN(n))) return true;
    // FIX (SSRF): در فرم‌های کوتاه‌شده IPv4 بایت‌های میانی صفرند و «آخرین» جزء
    // تمام بایت‌های باقی‌مانده را نگه می‌دارد: "127.1" یعنی 127.0.0.1 و
    // "2130706433" (تک‌جزئی) خودش همان عدد ۳۲بیتی است. الگوی صحیح: هر جزء
    // غیرآخر ≤255 + جمع با توانِ موقعیت به‌علاوه بایت‌های صفرِ میانی؛ سرریز
    // بیش از ۳۲ بیت → بلاک. (فرمول قبلی تک‌جزئی را ×256³ می‌کرد → دورزدن.)
    if (nums.slice(0, -1).some((n) => n > 255)) return true;
    let val = 0;
    for (let i = 0; i < nums.length; i++) {
      const shiftBytes = Math.max(0, 4 - nums.length);
      val += nums[i] * Math.pow(256, 3 - i + shiftBytes);
    }
    if (!Number.isFinite(val) || val > 0xffffffff) return true;
    const a = Math.floor(val / Math.pow(256, 3)) % 256;
    const b = Math.floor(val / Math.pow(256, 2)) % 256;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local + cloud metadata (169.254.169.254)
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast/reserved
    return false;
  }
  return false;
}

/** https-only safe URL filter; returns undefined when blocked/invalid. */
export function safeHttpUrl(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'https:') return undefined;
    // FIX — دورزدن blocklist با authority trick: «https://evil.com\@127.0.0.1»
    // در مرورگرها host=evil.com است ولی بعضی fetchرها backslash را / تلقی کرده
    // و userinfo نادیده می‌رود. هرگز پس از credential separator نباید بماند.
    if (/[\\@]/.test(u.host)) return undefined;
    if (isBlockedHostname(u.hostname)) return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

/**
 * Allowlist feed URL — فقط دامنه‌های مجاز فید، بدون credential trick، بدون
 * path traversal (..)، بدون control char/backspace که مسیر واقعی را جابه‌جا
 * می‌کنند. ورودی نامعتبر → undefined.
 */
export function safeFeedUrl(raw: string | undefined | null, allowedHosts: ReadonlySet<string>): string | undefined {
  if (!raw || raw.length > 512) return undefined;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'https:' || u.port) return undefined;
    if (!allowedHosts.has(u.hostname.toLowerCase())) return undefined;
    if (/[\\@]/.test(u.host)) return undefined;
    if (/[\x00-\x1f\x7f\u2028\u2029]/.test(u.href)) return undefined;
    if (u.pathname.split('/').includes('..')) return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

/**
 * FIX — «سایت خالی از خبر» روی Vercel: فیلتر بالا سخت‌گیرانه https-only بود؛
 * بسیاری از فیدها (The Verge و…) لینک http می‌دهند و همه مقالات دور ریخته
 * می‌شدند → seed خالی، فید خالی. حالا http:// هم پذیرفته می‌شود اما فقط برای
 * هاست‌های مجازِ فید (آلوده‌سازی خروجی با دامنه‌های ناشناخته همچنان مسدود).
 */
const TRUSTED_FEED_HOSTS = new Set([
  'feeds.arstechnica.com',
  'arstechnica.com',
  'www.theverge.com',
  'theverge.com',
  'techcrunch.com',
  'www.wired.com',
  'wired.com',
  'www.nasa.gov',
  'nasa.gov',
  'feeds.bbci.co.uk',
  'www.bbc.co.uk',
  'bbc.co.uk',
  'www.theguardian.com',
  'theguardian.com',
]);

export function safeArticleUrl(raw: string | undefined | null): string | undefined {
  const https = safeHttpUrl(raw);
  if (https) return https;
  if (!raw) return undefined;
  try {
    const u = new URL(String(raw).trim());
    if (u.protocol === 'http:' && TRUSTED_FEED_HOSTS.has(u.hostname.toLowerCase())) {
      return u.toString();
    }
  } catch {
    /* invalid url -> drop */
  }
  return undefined;
}

/** فیلترهای مجاز برای دسته‌بندی — بدون وابستگی به config (گراف کلاینت/سرور safe) */
const ALLOWED_CATEGORIES = new Set<string>([
  'ai', 'gadgets', 'software', 'hardware', 'security', 'space', 'startups',
]);

export function normalizeArticle(raw: RawNewsApiArticle, category: NewsCategoryId): Article | null {
  const title = sanitizeText(raw.title ?? '', 200);
  // SECURITY: link خام عبور نمی‌کند — javascript:/http://IP-private دور ریخته می‌شود
  // (http فقط برای هاست‌های مجاز فید — FIX «فید خالی»؛ v0.14 https-only همه را حذف می‌کرد)
  const url = safeArticleUrl(raw.url) ?? '';
  if (!title || !url) return null;

  // FIX — XSS در بدنه صفحه جزئیات: toParagraphs پس از stripHtml دوباره &lt;/&gt;
  // را به < > برمی‌گرداند؛ اگر محتوا "&amp;lt;script&amp;gt;" داشت، پاس دوم یک
  // <script> زنده می‌ساخت (double-decode). حالا خروجی strip-to-text است و هر
  // کاراکتر حساس صرف‌نظر از منبع (raw یا entity-encoded) دقیقاً یک‌بار escape
  // می‌شود؛ دیگر هیچ نقطه‌ای در UI این رشته را HTML-پارس نمی‌کند.
  // + FIX — تداخل entity با truncate: قبلاً escape پیش از truncate بود و اگر
  // برش وسط «&amp;» می‌افتاد، موجود ناقص تولید می‌شد؛ حالا اول truncate روی
  // متن خالص، بعد escape.
  // + FIX — escape دوباره روی خروجی stripToText حذف شد: آن تابع خودش تا
  // fixpoint دیکد و یک‌بار escape می‌کند؛ escape مجدد باعث می‌شد «&lt;» در
  // React به شکل رشته خام «&amp;lt;» به کاربر نمایش داده شود (باگ رگرسیون UI).
  const toSafeBody = (input: string, max: number): string =>
    truncate(stripToText(input), max);

  const summary = raw.description != null && String(raw.description).trim()
    ? toSafeBody(String(raw.description), 300)
    : raw.content != null
      ? toSafeBody(String(raw.content), 300)
      : '';

  // FIX — آمار نادرست داشبورد/آنالیتیکس: مقالات دستی ادمین با ستون category
  // ذخیره می‌شوند ولی تا اینجا آن فیلد دور ریخته می‌شد و همه مقالات دستی
  // ذیل دسته fallback (مثلاً 'ai') شمرده می‌شدند؛ حالا category صریحِ ورودی
  // (اگر در فهرست مجاز باشد) بر inferCategory اولویت دارد.
  const explicitCategory = typeof raw.category === 'string' && ALLOWED_CATEGORIES.has(raw.category)
    ? (raw.category as NewsCategoryId)
    : undefined;

  const publishedAt = parseDate(raw.publishedAt);

  // FIX — پایداری seed/کلاینت: id قبلاً با uid() تصادفی بود؛ حالا خودِ URL هویت
  // پایدار است تا dedupe و تطبیق seed سرور با داده تازه (markRead/bookmark)
  // درست بماند. uid فقط fallback است.
  const article: Article = {
    id: url ? `art-${url}` : uid('art'),
    title,
    summary,
    content: raw.content != null ? toSafeBody(String(raw.content), 2000) : undefined,
    url,
    // SECURITY: تصویر هم از همان فیلتر https/blocklist عبور می‌کند
    imageUrl: safeHttpUrl(raw.urlToImage ?? undefined),
    // FIX — فیلد author هم مثل title از فیلتر sanitize عبور می‌کند (قبلاً خام بود)
    author: raw.author ? sanitizeText(raw.author, 120) : undefined,
    source: {
      id: raw.source?.id ?? 'unknown',
      name: raw.source?.name ?? 'Unknown source',
      url: raw.url ?? undefined,
    },
    category: explicitCategory ?? category,
    tags: [],
    publishedAt,
    fetchedAt: Date.now(),
    isRead: false,
    isBookmarked: false,
  };

  return isValidArticle(article) ? article : null;
}

export function inferCategory(raw: RawNewsApiArticle, fallback: NewsCategoryId): NewsCategoryId {
  // FIX — دسته‌بندی نادرست مقالات ادمین: اگر ستون category صریح و معتبر آمد،
  // هیچ‌گاه از حدس متنی رد نمی‌شود (قبلاً «tech» ذیل هیچ regex نمی‌افتاد و
  // همه مقالات دستی در fallback قرار می‌گرفتند).
  if (typeof raw.category === 'string' && ALLOWED_CATEGORIES.has(raw.category)) {
    return raw.category as NewsCategoryId;
  }
  const text = `${raw.title ?? ''} ${raw.description ?? ''}`.toLowerCase();
  if (/\bai\b|هوش مصنوعی|machine learning/.test(text)) return 'ai';
  if (/gadget|گجت|wearable/.test(text)) return 'gadgets';
  if (/security|امنیت|hack/.test(text)) return 'security';
  if (/space|فضا|nasa|moon/.test(text)) return 'space';
  if (/startup|استارتاپ|funding/.test(text)) return 'startups';
  return fallback;
}

export function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
}

/** Dedupe helper kept in one place so server and client paths stay identical. */
export { dedupeArticles };

/**
 * FIX — Performance (LCP موبایل): نرمال‌سازی آیتم‌های فید سروری به Article[].
 * قبلاً نتیجه فقط در cacheService سمت سرور نوشته می‌شد که در مرورگر وجود
 * ندارد → NewsFeed بعد از hydrate دوباره /api/rss را fetch/parse می‌کرد
 * (ریشه LCP=6.9s). حالا خروجی این تابع در <script type="application/json">
 * داخل HTML اولیه سریال می‌شود و کلاینت پیش از اولین effect آن را می‌خواند.
 */
export function buildArticlesFromRssItems(items: RssItem[]): Article[] {
  const raw: RawNewsApiArticle[] = items.map((item) => ({
    title: item.title,
    description: item.description ?? null,
    url: item.link,
    urlToImage: item.imageUrl ?? item.pageImageUrl ?? null,
    publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : null,
    author: item.author ?? null,
    content: item.description ?? null,
    // FIX — آمار نادرست آنالیتیکس/دسته‌ها: category مقالات دستی منتقل می‌شود
    category: item.category ?? null,
    source: { id: item.link, name: safeHostname(item.link) },
  }));
  return dedupeArticles(
    raw
      .map((r) => normalizeArticle(r, inferCategory(r, 'ai')))
      .filter((a): a is Article => a !== null),
  );
}
