// src/app/api/rss/route.ts
import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_HOSTS = new Set([
  'feeds.arstechnica.com',
  'www.theverge.com',
  'techcrunch.com',
]);

const FETCH_TIMEOUT = 8000;

interface RssItem {
  title: string;
  link: string;
  description?: string;
  pubDate?: string;
  author?: string;
}

function parseRss(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const matches = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];

  const pickTag = (block: string, tag: string): string | undefined => {
    const m = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i').exec(block);
    return m?.[1]?.trim();
  };

  for (const block of matches.slice(0, 40)) {
    const title = pickTag(block, 'title');
    const link = pickTag(block, 'link');
    if (!title || !link) continue;

    items.push({
      title,
      link,
      description: pickTag(block, 'description'),
      pubDate: pickTag(block, 'pubDate'),
      author: pickTag(block, 'author'),
    });
  }
  return items;
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'پارامتر url لازم است.' }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: 'url نامعتبر است.' }, { status: 400 });
  }

  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return NextResponse.json({ error: 'این دامنه مجاز نیست.' }, { status: 403 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'ORBIT/0.1 (+https://orbit.local)' },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `پاسخ نامعتبر از فید (${res.status})` },
        { status: 502 },
      );
    }

    const xml = await res.text();
    const items = parseRss(xml);

    return NextResponse.json(
      { items },
      { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'خطای ناشناخته';
    return NextResponse.json({ error: `دریافت فید ناموفق بود: ${msg}` }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}