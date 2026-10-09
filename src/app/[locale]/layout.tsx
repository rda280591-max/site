import type { Metadata, Viewport } from "next";

import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import {
  getMessages,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { Vazirmatn } from "next/font/google";
import { Suspense } from "react";
import { routing, getDirection, LOCALES } from "@/i18n/routing";
import { peekLcpHint } from "@/core/lcpHints";
/* FIX — بازیابی ایمپورت سبیل‌ها؛ بدون این خط Tailwind/globals.css اصلاً لود نمی‌شد
 * و کل سایت «به‌هم‌ریخته» (بدون هیچ استایلی) رندر می‌شد. */
import "../globals.css";

/*
 * FIX — Performance (LCP / render-blocking font ~400ms)
 *   preload:true → Next.js برای فایل فونت <link rel="preload"> می‌گذارد؛
 *   display:'swap' متن را با فونت سیستمی سریع نشان می‌دهد و FOUT کوتاه است.
 */
const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-vazirmatn",
  display: "swap",
  // PERF: next/font خودش preload می‌کند؛ `preload:true` باعث لود نسخه‌های
  // اضافی ویندز/اندروید (fallback) روی همه دستگاه‌ها می‌شد → درخواست‌های
  // بی‌مصرف فونت و رقابت با LCP.
  preload: false,
});

/**
 * اسکریپت ضدفلش تم — نسخه‌ی «بدون رندر بلاک».
 * defer باعث می‌شود پارسر HTML روی اجرای جاوااسکریپت قفل نشود (بهبود FCP/TBT).
 * data-theme پیش‌فرض روی «dark» تنظیم شده تا حتی یک فریم هم بدون تم نماند.
 */
/**
 * Origin Supabase برای warm-up DNS/TLS. عمداً فقط dns-prefetch (نه preconnect):
 * preconnect با env runtime متفاوت در build استاتیک اشتباه می‌کند؛ dns-prefetch
 * بی‌ضرر، بدون هزینه و build-safe است — handshake TLS موقع lazy-load auth chunk
 * را سریع‌تر می‌کند.
 */
const SUPABASE_ORIGIN = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
})();

const themeScript = `(function(){try{var m=document.documentElement,s=localStorage.getItem('orbit:theme');m.setAttribute('data-theme',(s==='light'||s==='dark')?s:(window.matchMedia('(prefers-color-scheme:light)').matches?'light':'dark'));}catch(e){}})();`;




export const viewport: Viewport = {
  themeColor: "#0B0E17",
  width: "device-width",
  initialScale: 1,
};

/** Full site URL — for absolute metadata (OG/canonical) and JSON-LD. */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://fdgneg.vercel.app";

/**
 /* ORBIT — locale layout
 *
 * این لایه:
 *  - <html lang dir> را بر اساس زبان فعال تنظیم می‌کند (en → ltr، fa → rtl)
 *  - پیام‌های زبان را به کلاینت تزریق می‌کند (NextIntlClientProvider)
 *  - اسکریپت تم را همان‌طور که قبلاً بود نگه می‌دارد (بدون فلش روشن/تیره)
 */

/** Pre-builds static paths for both locales (build-time + SEO). */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

/*
 * FIX — ریشه‌ی 404 پنل ادمین روی Vercel:
 * وجود generateStaticParams در این layout باعث شد Next حالت «fully static»
 * بگیرد و زیرمسیرهای ناشناخته مثل /en/admin با 404 رندر شوند. با بازکردن
 * dynamicParams، مسیرهای جدید (admin و هر صفحه آینده) بدون rebuild سرو می‌شوند؛
 * صفحات اصلی همچنان به همان شکل قبلی prerender می‌مانند → بدون افت LCP.
 */
export const dynamicParams = true;

/**
 * FIX — ریشه‌ی نمره ۱/۲ SEO روی موبایل:
 * قبلاً متادیتا فقط در layout بود؛ پس همه صفحات (/news, /notes, /settings,
 * /analytics, /login) یک canonical تکراری و یک title/توضیحات یکسان داشتند
 * → خطای «duplicate meta tags / invalid canonical» در Lighthouse.
 * حالا هر صفحه canonical و hreflang مخصوص خودش را می‌گیرد.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};

  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: t("title"),
      template: `%s | ${t("siteName")}`,
    },
    description: t("description"),
    keywords: [
      "ORBIT",
      "technology news",
      "dashboard",
      "اخبار تکنولوژی",
      "مرکز فرماندهی",
      "tech analytics",
      "news feed",
    ],
    applicationName: "ORBIT",
    // SEO: indexing always open (no noindex) and corresponding multilingual pages declared.
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large" },
    },
    alternates: {
      // Home default canonical; inner pages override it.
      canonical: `${SITE_URL}/${locale}`,
      languages: {
        en: `${SITE_URL}/en`,
        fa: `${SITE_URL}/fa`,
        "x-default": `${SITE_URL}/en`,
      },
    },
    openGraph: {
      type: "website",
      locale: locale === "fa" ? "fa_IR" : "en_US",
      url: `${SITE_URL}/${locale}`,
      siteName: "ORBIT",
      title: t("title"),
      description: t("description"),
      images: [
        {
          url: `${SITE_URL}/globe.svg`,
          width: 1200,
          height: 630,
          alt: "ORBIT — Technology Command Center",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
      images: [`${SITE_URL}/globe.svg`],
    },
    category: "technology",
    formatDetection: { email: false, address: false, telephone: false },
  };
}

/** JSON-LD structured data (Schema.org) — rich signal for Google. */
function jsonLd(locale: string, title: string, description: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "ORBIT",
    alternateName: "ORBIT — Technology Command Center",
    url: `${SITE_URL}/${locale}`,
    description,
    inLanguage: locale === "fa" ? "fa-IR" : "en-US",
    publisher: {
      "@type": "Organization",
      name: "ORBIT",
      url: SITE_URL,
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  // unsupported locale -> 404 (instead of rendering with the wrong locale)
  if (!hasLocale(routing.locales, locale)) notFound();

  // enable static rendering for this locale (required by next-intl in App Router)
  setRequestLocale(locale);

  const messages = await getMessages();
  const dir = getDirection(locale);
  const t = await getTranslations({ locale, namespace: "meta" });
  /*
   * FIX — LCP موبایل: preload تصویر کارت اول (اگر صفحه آن را ثبت کرده باشد).
   * فقط برای خانه؛ بقیه layoutها hint ندارند و هیچ تگی رندر نمی‌شود.
   */
  const lcpHint = peekLcpHint(locale);

  return (
    <html
      lang={locale}
      dir={dir}
      data-theme="dark"
      className={vazirmatn.variable}
      suppressHydrationWarning
    >
      <head>
        {/*
         * PERF: فونت توسط next/font به‌صورت self-hosted در همان origin سرو می‌شود؛
         * preconnect به Google Fonts فقط یک اتصال TLS بی‌مصرف باز می‌کرد.
         * FIX — LCP موبایل (هشدار «بیش از ۴ preconnect»): دو preconnect ثابت
         * BBC/MEN با یک dns-prefetch جایگزین شدند (DNS warm ارزان و بدون slot
         * اتصال)؛ تنها preconnect واقعیِ پرهزینه، origin تصویر LCP است که
         * پایین‌تر و فقط وقتی وجود دارد که کارت اول واقعاً تصویر داشته باشد.
         */}
        <link rel="dns-prefetch" href="https://ichef.bbci.co.uk" />
        <link rel="dns-prefetch" href="https://images.immediate.co.uk" />
        <link rel="dns-prefetch" href="https://www.theverge.com" />
        {SUPABASE_ORIGIN ? <link rel="dns-prefetch" href={SUPABASE_ORIGIN} /> : null}
        <link rel="dns-prefetch" href="https://cdn.arstechnica.net" />
        {/*
          FIX — LCP موبایل (ریشه‌ی LCP=6.9s): preload + preconnect اختصاصی به
          تصویر کارت اول. دانلود LCP حالا هم‌سطح CSS شروع می‌شود، نه بعد از
          hydrate. مقادیر فقط از allowlist https سرور (src/core/lcpHints.ts).
          NOTE: بدون crossOrigin روی هر دو تگ — crossorigin متفاوت باعث می‌شود
          preload cache-hit نشود و تصویر دوباره دانلود شود.
        */}
        {lcpHint ? (
          <>
            <link rel="preconnect" href={lcpHint.origin} />
            <link
              rel="preload"
              as="image"
              href={lcpHint.url}
              fetchPriority="high"
            />
          </>
        ) : null}
        {/* SEO: اتصال sitemap + داده ساختاریافته JSON-LD */}
        <link rel="sitemap" type="application/xml" href="/sitemap.xml" />
        <link rel="alternate" type="application/rss+xml" title="ORBIT RSS" href="/api/rss" />
        {/* Agentic Browsing: کشف llms.txt توسط عامل‌های AI از داخل HTML */}
        <link rel="llms" type="text/plain" href="/llms.txt" />
        <link rel="llms-full" type="text/plain" href="/llms-full.txt" />
        <script
          type="application/ld+json"
          // SECURITY (فاز ۳): ضد XSS-in-JSON-LD — escape یونیکدِ workهای حساس
          // context؛ اگر متادیتا روزی شامل </script> یا UGC شود، گریز از JSON
          // ممکن نیست. مقدار داخل JSON هم معتبر می‌ماند (\uXXXX escape مجاز است).
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd(locale, t("title"), t("description"))).replace(
              /[<>&]/g,
              (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
            ),
          }}
        />
        {/*
         * FIX — Performance (TBT / render-blocking script)
         * defer: پارسر HTML روی اجرای اسکریپت قفل نمی‌شود؛ تم پیش‌فرض
         * از قبل روی data-theme='dark' ست شده پس فلشی هم ایجاد نمی‌شود.
         */}
        <script
          // SECURITY — رفع نشت nonce: Next.js در rewrite هدر، placeholder '{}'
          // را جایگزین نمی‌کند و دقیقاً رشته «{}» به‌عنوان nonce در HTML منتشر
          // می‌شد. چون CSP این سایت script-src بر پایه SHA-256 hashهای ثابت
          // next.config.ts است (نه nonce)، خود صفت nonce بی‌مصرف و مضر بود → حذف.
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />
        {/* FIX — Performance: انیمیشن‌های ورودی فقط بعد از اولین پینت فعال می‌شوند */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){var on=function(){document.documentElement.classList.add('orbit-animations-on');};if('requestAnimationFrame' in window){requestAnimationFrame(function(){requestAnimationFrame(on);});}else{setTimeout(on,150);}})();",
          }}
        />
      </head>
      <body>
        {/*
         * FIX — Accessibility (بخش‌های تکراری و پرشونده)
         * Skip-link اولین عنصر تعاملی صفحه است و با Tab قابل دسترسیست.
         */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-orbit-primary focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
        >
          {locale === "fa" ? "پرش به محتوای اصلی" : "Skip to main content"}
        </a>
        <Suspense>
          <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
        </Suspense>
        </body>
    </html>
  );
}