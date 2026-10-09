import type { MetadataRoute } from 'next';

/**
 * ORBIT — sitemap.xml (SEO)
 /* All public pages listed for both locales (en/fa) with matching hreflang.
 */
const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://fdgneg.vercel.app';

type Page = { en: string; fa: string; priority: number; changeFrequency: 'daily' | 'weekly' | 'monthly' };

const PAGES: Page[] = [
  { en: '/en', fa: '/fa', priority: 1.0, changeFrequency: 'daily' },
  { en: '/en/news', fa: '/fa/اخبار', priority: 0.9, changeFrequency: 'daily' },
  { en: '/en/analytics', fa: '/fa/تحلیل', priority: 0.8, changeFrequency: 'weekly' },
  { en: '/en/notes', fa: '/fa/یادداشت‌ها', priority: 0.7, changeFrequency: 'weekly' },
  { en: '/en/settings', fa: '/fa/تنظیمات', priority: 0.5, changeFrequency: 'monthly' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return PAGES.flatMap(({ en, fa, priority, changeFrequency }) => [
    {
      url: `${BASE}${en}`,
      lastModified: now,
      changeFrequency,
      priority,
      alternates: { languages: { fa: `${BASE}${fa}`, en: `${BASE}${en}` } },
    },
    {
      url: `${BASE}${fa}`,
      lastModified: now,
      changeFrequency,
      priority,
      alternates: { languages: { en: `${BASE}${en}`, fa: `${BASE}${fa}` } },
    },
  ]);
}
