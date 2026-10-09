import { pageMetadata } from "@/core/pageMeta";

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
  return pageMetadata(locale, "settings");
}

export { default } from "./Page.client";
