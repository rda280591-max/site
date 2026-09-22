// ORBIT — داده‌ی نمونه
import { NEWS_CATEGORIES, type NewsCategoryId } from '@/core/config';
import type { RawNewsApiArticle } from '@/services/http/interceptors';
import type { NewsQuery } from '@/types/news';

const SAMPLE_TITLES = [
  'مدل جدید هوش مصنوعی با توان استدلال پیشرفته معرفی شد',
  'تراشه نسل بعدی با معماری ۲ نانومتری رونمایی شد',
  'رونمایی از گجت پوشیدنی با باتری دو هفته‌ای',
  'زبان برنامه‌نویسی جدید با تمرکز بر ایمنی حافظه',
  'پروژه فضایی خصوصی به مدار ماه رسید',
  'استارتاپ حوزه امنیت، ۵۰ میلیون دلار جذب کرد',
  'سیستم‌عامل جدید با تمرکز بر حریم خصوصی منتشر شد',
  'کوانتوم‌کامپیوتر جدید رکورد محاسباتی شکست',
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
    description: `توضیح کوتاه درباره‌ی «${title}». این یک داده‌ی نمونه است.`,
    content: `محتوای کامل درباره‌ی «${title}».`,
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
  const articles: RawNewsApiArticle[] = [];
  for (let i = 0; i < pageSize; i++) {
    const cat = categories[i % categories.length];
    articles.push(makeArticle(i + ((query.page ?? 1) - 1) * pageSize, cat));
  }
  await new Promise((r) => setTimeout(r, 350));
  return { articles, total: 200 };
}

export const MockProvider = { fetch: fetchFromMock };