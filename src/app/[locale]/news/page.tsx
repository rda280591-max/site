import { pageMetadata } from "@/core/pageMeta";
import { serializeJsonForScriptTag, newsSeedElementId } from "@/core/serializeNews";
import { getPrefetchedNewsItemsWithFallback } from "@/services/news/feeds.server";
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
}) {
  const { locale } = await params;
  return pageMetadata(locale, "news");
}

/**
 /* FIX — Performance (LCP/TBT): same server prefetch as the home page for the full-width feed.
 */
export default async function NewsPage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  void locale; // setRequestLocale already ran in layout; kept here only for cache stability
  const items = await getPrefetchedNewsItemsWithFallback();
  // FIX — LCP موبایل: همان seed HTML اولیه مثل صفحه خانه (تگ JSON قبل hydrate
  // توسط newsStore خوانده می‌شود → فید بدون waterfall شبکه‌ای رندر می‌شود).
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
