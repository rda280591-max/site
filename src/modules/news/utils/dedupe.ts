import type { Article } from '@/types/news';

function articleKey(a: Article): string {
  if (a.url) return a.url.toLowerCase();
  return a.title.trim().toLowerCase().slice(0, 80);
}

export function dedupeArticles(articles: Article[]): Article[] {
  const seen = new Set<string>();
  const out: Article[] = [];
  for (const a of articles) {
    const k = articleKey(a);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(a);
  }
  return out;
}