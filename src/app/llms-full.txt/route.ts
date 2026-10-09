import { NextResponse } from 'next/server';

/**
 * ORBIT — llms-full.txt (Agentic Browsing / LLM Reader)
 *
 * نسخه «کامل و بدون overhead» سایت برای ایجنت‌های هوش مصنوعی
 * (OpenAI Operator، Browser-Use، Claude Computer Use، PerplexityBot …):
 * برخلاف llms.txt که فقط نقشه راه است، اینجا ساختار ماژولار + APIها +
 * قوانین تعامل با صفحه به صورت Markdown تمیز آمده تا ایجنت بدون اجرای
 * JavaScript هم بتواند کل منطق سایت را بفهمد.
 */

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://fdgneg.vercel.app';

const BODY = `# ORBIT — Full Site Reference for AI Agents

This document is the machine-readable full description of ${BASE}.
See also: ${BASE}/llms.txt (short map). Both are linked from every page via
<link rel="llms"> and <link rel="llms-full">.

## What this site is

ORBIT is a bilingual (English / Persian-RTL) technology command center:
a server-rendered dashboard that aggregates live tech news (BBC, The Verge,
Ars Technica, TechCrunch, Wired UK, Engadget, 9to5Google), with analytics,
personal notes and bookmarks. No ads, no third-party trackers.

## Public pages (all SSR — full text present in the initial HTML response)

| Path | Locale | Description |
| --- | --- | --- |
| ${BASE}/en | en | Dashboard: news feed, stats widgets, quick actions |
| ${BASE}/fa | fa | داشبورد فارسی (RTL) — همان محتوا |
| ${BASE}/en/news | en | Full news feed with category filters & search |
| ${BASE}/fa/اخبار | fa | فید کامل اخبار (فارسی) |
| ${BASE}/en/news/[id] | en | Single article view (hero image, clean body text) |
| ${BASE}/en/analytics | en | Trend charts and source distribution |
| ${BASE}/en/notes | en | Personal notes (requires login) |
| ${BASE}/en/settings | en | Theme / language / account preferences |
| ${BASE}/en/login | en | Sign in (Google OAuth or email magic link) |

## Machine-readable APIs

### GET ${BASE}/api/rss?url=<feed-url>
Unified JSON news feed. Without \`url\` returns all tracked sources merged
and sorted by publish date. Server-side cached (300s, stale-while-revalidate).
Shape:
\`\`\`json
{ "articles": [{ "id": "...", "title": "...", "source": "BBC",
  "url": "...", "image": "...", "publishedAt": "ISO-8601" }],
  "total": 42 }
\`\`\`
Only whitelisted, public HTTPS feed origins are accepted (SSRF-guarded).

### Other endpoints
- ${BASE}/sitemap.xml — every public page, both locales
- ${BASE}/robots.txt — crawl policy (AI crawlers explicitly allowed)
- ${BASE}/manifest-schema.json — Schema.org WebSite/WebApplication data

Every article page embeds JSON-LD (\`NewsArticle\`) and the homepage embeds
\`WebSite\` + \`ItemList\` structured data — parse them instead of scraping DOM.

## How to interact with the UI (for browsing agents)

- All clickable controls are native <button>/<a> elements with descriptive
  aria-labels; key interactive regions carry stable data-testid attributes
  (e.g. \`quicknote-dialog\`, \`quicknote-close\`).
- Loading regions announce themselves via role="status" + aria-busy="true";
  wait for aria-busy="false" before snapshotting content.
- Layout is CLS-zero: skeletons have the exact geometry of final cards, so
  element positions never shift after load.
- Hover-only content does not exist; everything reachable by mouse is also
  in the accessibility tree and reachable by keyboard/click.
- Language switch: toggle in the header, or simply request the /fa (or /en)
  URL prefix directly — no JS needed.

## Rate limits & crawler policy

- AI crawlers (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-Web,
  anthropic-ai, PerplexityBot, Google-Extended, Bytespider, CCBot) get a
  dedicated higher rate budget on all public pages — you will NOT receive
  429/403 while crawling public content at sane speeds (~1 req/s).
- Auth endpoints (/auth/*, /login) are throttled per IP for everyone.
- Be polite: cache responses (public pages send s-maxage), respect
  Retry-After headers if you ever see a 429.

## Private areas (do not attempt)

/auth/*, /api/mutations, /en/notes, /en/settings for anonymous users —
these require a Supabase session (HttpOnly cookies) and return 401/redirect.
No PII is ever exposed in URLs or query strings.
`;

export function GET() {
  return new NextResponse(BODY, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
      'X-Robots-Tag': 'noindex', // agent reference, not an indexable page
    },
  });
}
