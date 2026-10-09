import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";

/**
 /* ORBIT — per-page dedicated metadata (SEO)
 *
 * چرا این فایل وجود دارد؟
 * قبلاً title/description/canonical فقط در [locale]/layout.tsx تعریف شده بود؛
 * یعنی همه‌ی صفحات (/news، /notes، /settings، /analytics، /login) یک canonical
 * تکراری به آدرس خانه داشتند و Lighthouse روی موبایل نمره SEO را ۱/۲ می‌گرفت
 * (خطای "document does not have a valid canonical link" / duplicate tags).
 * حالا هر صفحه با این هلپر، canonical + hreflang + title + description
 * منحصربه‌فرد خودش را می‌گیرد.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://fdgneg.vercel.app";

export type PageKey = "home" | "news" | "analytics" | "notes" | "settings" | "login";

/** English pathname per key (for building the canonical URL). */
const EN_PATH: Record<PageKey, string> = {
  home: "/en",
  news: "/en/news",
  analytics: "/en/analytics",
  notes: "/en/notes",
  settings: "/en/settings",
  login: "/en/login",
};

/** Persian equivalent pathname (same as project pathnames in i18n/routing.ts). */
const FA_PATH: Record<PageKey, string> = {
  home: "/fa",
  news: "/fa/اخبار",
  analytics: "/fa/تحلیل",
  notes: "/fa/یادداشت‌ها",
  settings: "/fa/تنظیمات",
  login: "/fa/ورود",
};

function abs(path: string): string {
  return `${SITE_URL}${encodeURI(path)}`;
}

/**
 /* @param locale  active locale ('en' | 'fa')
 /* @param key     page key
 /* @param opts.noindex  pages like login that must not be indexed
 */
export async function pageMetadata(
  inputLocale: string,
  key: PageKey,
  opts?: { noindex?: boolean },
): Promise<Metadata> {
  // next-intl has strict types; we normalize locale to a valid value.
  const locale: AppLocale = inputLocale === "fa" ? "fa" : "en";
  const isFa = locale === "fa";

  // Page-specific title/description from the "metaPages" namespace.
  // next-intl is type-safe, so each key is selected explicitly (no dynamic strings).
  const tp = await getTranslations({ locale, namespace: "metaPages" });
  const titleMap = {
    home: tp("home.title"),
    news: tp("news.title"),
    analytics: tp("analytics.title"),
    notes: tp("notes.title"),
    settings: tp("settings.title"),
    login: tp("login.title"),
  } as const;
  const descMap = {
    home: tp("home.description"),
    news: tp("news.description"),
    analytics: tp("analytics.description"),
    notes: tp("notes.description"),
    settings: tp("settings.description"),
    login: tp("login.description"),
  } as const;
  const title = titleMap[key];
  const description = descMap[key];

  const self = abs(isFa ? FA_PATH[key] : EN_PATH[key]);
  const enUrl = abs(EN_PATH[key]);
  const faUrl = abs(FA_PATH[key]);

  return {
    // template-less title so <title> is exactly this clean value.
    title,
    description,
    robots: opts?.noindex
      ? { index: false, follow: true }
      : {
          index: true,
          follow: true,
          googleBot: { index: true, follow: true, "max-image-preview": "large" },
        },
    alternates: {
      canonical: self,
      languages: {
        en: enUrl,
        fa: faUrl,
        "x-default": enUrl,
      },
    },
    openGraph: {
      type: "website",
      locale: isFa ? "fa_IR" : "en_US",
      url: self,
      siteName: "ORBIT",
      title,
      description,
      images: [
        {
          url: `${SITE_URL}/globe.svg`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${SITE_URL}/globe.svg`],
    },
  };
}
