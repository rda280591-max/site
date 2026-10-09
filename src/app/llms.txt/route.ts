import { NextResponse } from 'next/server';

/**
 * ORBIT — llms.txt (Agentic Browsing)
 *
 * استاندارد llms.txt (llmstxt.org) به عامل‌های هوش مصنوعی (ChatGPT، Gemini،
 * Perplexity و ابزارهای «agentic browsing») یک نسخه‌ی متنیِ تمیز و قابل‌مصرف
 * از ساختار و محتوای سایت می‌دهد. Lighthouse در بخش Agentic Browsing وجود و
 * صحت همین فایل (+ لینک <link rel="llms"> در HTML) را بررسی می‌کند.
 *
 /* plain/text output with charset=utf-8 and a short cache so bots always get a fresh copy.
 */

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://fdgneg.vercel.app';

const BODY = `# ORBIT

> ORBIT — Technology Command Center. Your personal command center in the
> technology orbit: a fast, bilingual (English / Persian) dashboard that
> aggregates live technology news from BBC, The Verge, Ars Technica and more,
> with analytics and personal notes — no ads, no trackers.

## Pages

- [Home (EN)](${BASE}/en): Main dashboard with the latest tech news feed.
- [Home (FA)](${BASE}/fa): نسخه فارسی داشبورد — آخرین اخبار تکنولوژی.
- [News (EN)](${BASE}/en/news): Full technology news feed, updated continuously from RSS sources.
- [News (FA)](${BASE}/fa/اخبار): فید کامل اخبار تکنولوژی به فارسی.
- [Analytics (EN)](${BASE}/en/analytics): Overview of tech-news trends and source distribution.
- [Notes (EN)](${BASE}/en/notes): Personal notes workspace synced with the user account.
- [Settings (EN)](${BASE}/en/settings): Theme, language and account preferences.

## Machine-readable endpoints

- [RSS aggregator](${BASE}/api/rss): Unified JSON feed of all tracked sources (BBC, The Verge, Ars Technica, TechRadar, Wired UK, Engadget, 9to5Google).
- [sitemap.xml](${BASE}/sitemap.xml): All public pages for both locales.
- [manifest-schema.json](${BASE}/manifest-schema.json): Schema.org WebSite description.

## Notes for AI agents

- Content is publicly readable without login; only /login and account APIs are private.
- The site is fully server-rendered; page text is present in the initial HTML.
- Supported languages: en, fa (Persian, RTL).
`;

// NOTE: no force-static — prerendered at build (o) and served live in dev.

export function GET() {
  return new NextResponse(BODY, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      // کش کوتاه + اجازه crawl بدون محدودیت
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
