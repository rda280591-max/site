// ORBIT — نرمال‌سازی پاسخ‌های خام
import { ParseError } from '@/core/errors';
import { createLogger } from '@/core/logger';

const log = createLogger('services.http.interceptors');

export function pick<T = unknown>(obj: unknown, path: string): T | undefined {
  if (!path) return undefined;
  const parts = path.split('.');
  let current: unknown = obj;
  for (const p of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[p];
  }
  return current as T;
}

export function safeJsonParse<T = unknown>(input: string): T {
  try {
    return JSON.parse(input) as T;
  } catch (e) {
    throw new ParseError('تجزیه JSON ناموفق بود.', { input: input.slice(0, 200) }, e);
  }
}

export function parseDate(input: unknown): number {
  if (typeof input === 'number' && Number.isFinite(input)) return input;
  if (typeof input === 'string') {
    const t = Date.parse(input);
    if (!Number.isNaN(t)) return t;
  }
  log.warn('تاریخ نامعتبر؛ از زمان فعلی استفاده می‌شود.', { input });
  return Date.now();
}

export interface RawNewsApiArticle {
  source?: { id?: string | null; name?: string | null };
  author?: string | null;
  title?: string | null;
  description?: string | null;
  url?: string | null;
  urlToImage?: string | null;
  publishedAt?: string | null;
  content?: string | null;
}

export interface RawNewsApiResponse {
  status?: string;
  totalResults?: number;
  articles?: RawNewsApiArticle[];
}

export function normalizeNewsApiResponse(raw: unknown): { articles: RawNewsApiArticle[]; total: number } {
  const data = raw as RawNewsApiResponse;
  const articles = Array.isArray(data?.articles) ? data.articles : [];
  const total = typeof data?.totalResults === 'number' ? data.totalResults : articles.length;
  return { articles, total };
}

export const Interceptors = { pick, safeJsonParse, parseDate, normalizeNewsApiResponse };