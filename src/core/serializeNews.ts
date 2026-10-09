// ORBIT — سریال‌سازی امن داده RSC → <script type="application/json">
//
// FIX — ریشه اصلی LCP=6.9s موبایل: آیتم‌های خبر در HTML اولیه نبودند و
// NewsFeed بعد از hydrate با fetch /api/rss آن‌ها را می‌ساخت (LCP = فید +
// پارس + hydrate). حالا صفحه سروری همان آیتم‌ها را در تگ JSON داخل body
// می‌گذارد؛ کلاینت پیش از اولین effect می‌خواندشان → کارت اول (تصویر LCP)
// در اولین paint رندر می‌شود، بدون waterfall.
//
// SECURITY: </script> و کاراکترهای شکاف‌پذیر یونیکد escape می‌شوند؛ مقدار
// فقط از خروجی پارسر allowlist-شده فید می‌آید (نه UGC خام).

export function serializeJsonForScriptTag(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export const NEWS_SEED_ELEMENT_ID = "orbit-news-seed";

/** Build the seed tag id for document.getElementById on the client. */
export function newsSeedElementId(locale: string): string {
  return `${NEWS_SEED_ELEMENT_ID}-${locale}`;
}
