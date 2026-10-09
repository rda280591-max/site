// ORBIT — داده‌ی نمونه
//
// متن‌ها انگلیسی‌اند تا با زبان پیش‌فرض سایت (en) هم‌خوان باشند؛ فارسی‌بودن
// عنوان/خلاصه در حالت انگلیسی، متن ترجمه‌نشدنی و بی‌معنا بود.
import { NEWS_CATEGORIES, type NewsCategoryId } from '@/core/config';
import type { RawNewsApiArticle } from '@/services/http/interceptors';
import type { NewsQuery } from '@/types/news';

const SAMPLE_TITLES = [
  'New AI model ships with stronger reasoning abilities',
  'Next-generation chip built on a 2nm process unveiled',
  'Wearable gadget promises two weeks of battery life',
  'A new programming language puts memory safety first',
  'Private space mission reaches lunar orbit',
  'Security startup raises $50M in fresh funding',
  'New operating system launches with a privacy-first design',
  'Quantum computer breaks a new computational record',
];

const SAMPLE_SOURCES = [
  { id: 'mock-1', name: 'TechWire' },
  { id: 'mock-2', name: 'AI Times' },
  { id: 'mock-3', name: 'GadgetHub' },
];

function makeArticle(i: number, category: NewsCategoryId): RawNewsApiArticle {
  const title = SAMPLE_TITLES[i % SAMPLE_TITLES.length];
  const source = SAMPLE_SOURCES[i % SAMPLE_SOURCES.length];
  const hoursAgo = i * 2 + 1;
  return {
    title: `${title} — ${category}`,
    description: `A short summary of “${title}”. This is sample data.`,
    content: `Full story about “${title}”.`,
    url: `https://example.com/news/${category}/${i}`,
    urlToImage: `https://picsum.photos/seed/${category}-${i}/600/400`,
    publishedAt: new Date(Date.now() - hoursAgo * 3600_000).toISOString(),
    author: 'ORBIT Mock',
    source: { id: source.id, name: source.name },
  };
}

export async function fetchFromMock(query: NewsQuery = {}): Promise<{ articles: RawNewsApiArticle[]; total: number }> {
  const categories: NewsCategoryId[] = query.category && query.category !== 'all'
    ? [query.category]
    : NEWS_CATEGORIES.map((c) => c.id);
  const pageSize = query.pageSize ?? 20;
  const page = query.page ?? 1;

  // Bounded deterministic store: total is real so infinite scroll never runs forever.
  const poolSize = SAMPLE_TITLES.length * categories.length;
  const total = poolSize;
  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, total);

  const articles: RawNewsApiArticle[] = [];
  for (let i = start; i < end; i++) {
    const cat = categories[i % categories.length];
    articles.push(makeArticle(i, cat));
  }

  // FIX — Performance: artificial latency removed; feed render (LCP candidate) is now instant.
  return { articles, total };
}

export const MockProvider = { fetch: fetchFromMock };