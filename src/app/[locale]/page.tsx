import type { Metadata } from "next";
import { pageMetadata } from "@/core/pageMeta";
import { setLcpHint } from "@/core/lcpHints";
import { serializeJsonForScriptTag, newsSeedElementId } from "@/core/serializeNews";
import {
  getPrefetchedNewsItemsWithFallback,
  getLcpImageOrigin,
  getLcpImageUrl,
} from "@/services/news/feeds.server";
import { buildArticleSeedForHtml } from "@/services/news/seed";

/**
 * FIX SEO — متادیتای اختصاصی این صفحه (canonical + hreflang + title/description منحصربه‌فرد).
 * قبلاً canonical فقط در layout بود و همه صفحات یک canonical تکراری به آدرس خانه
 * داشتند؛ Lighthouse موبایل به‌خاطر «invalid/duplicate canonical» نمره SEO را نصف می‌کرد.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const base = pageMetadata(locale, "home");

  /*
   * FIX — LCP موبایل (ریشه‌ی LCP=6.9s در Moto G Power / Slow-4G):
   * preconnect خالی فقط handshake را جلو می‌اندازد؛ خودِ دانلود تصویر LCP
   * همچنان بعد از hydrate و رندر کارت شروع می‌شد. حالا URL/origin تصویر
   * کارت اول در lcpHints ثبت می‌شود و layout همان را به‌صورت
   * <link rel="preload" as="image"> + preconnect در HTML اولیه منتشر می‌کند
   * → دانلود تصویر LCP هم‌سطح CSS و قبل از JS آغاز می‌شود.
   */
  try {
    const items = await getPrefetchedNewsItemsWithFallback();
    const lcpOrigin = getLcpImageOrigin(items);
    const lcpUrl = getLcpImageUrl(items);
    if (lcpOrigin && lcpUrl) {
      setLcpHint(locale, { url: lcpUrl, origin: lcpOrigin });
      return {
        ...base,
        other: { "rel=preconnect": lcpOrigin },
      };
    }
  } catch {
    /* prefetch failed -> base metadata without preconnect */
  }
  return base;
}

/**
 * FIX — Performance (LCP/TBT): prefetch خبر در همان رندر سرور. آیتم‌ها داخل
 * RSC payload امبد و کش news سید می‌شوند؛ NewsFeed بعد از hydrate بدون
 * waterfall شبکه‌ای رندر می‌شود و کارت اول (تصویر LCP) زودتر paint می‌شود.
 */
export default async function HomePage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  void locale; // setRequestLocale already ran in layout; kept here only for cache stability
  const items = await getPrefetchedNewsItemsWithFallback();
  // FIX — ریشه اصلی LCP=6.9s موبایل: Article[] نرمال‌شده در HTML اولیه سریال
  // می‌شود (نه فقط کش instance سرور که به کلاینت نمی‌رسید). newsStore پیش از
  // اولین effect این تگ را می‌خواند → کارت اول و تصویر LCP در اولین paint.
  const seed = buildArticleSeedForHtml(items);
  const Page = (await import("./Page.client")).default;
  return (
    <>
      <Page />
      {seed.length > 0 && (
        <script
          type="application/json"
          id={newsSeedElementId(locale)}
          dangerouslySetInnerHTML={{ __html: serializeJsonForScriptTag(seed) }}
        />
      )}
    </>
  );
}
