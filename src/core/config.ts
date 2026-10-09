// ORBIT — central configuration
function readEnv(key: string, required = false, fallback = ''): string {
  const value = process.env[key] ?? fallback;
  if (required && !value) {
    const msg = `[ORBIT:Config] متغیر «${key}» یافت نشد.`;
    if (process.env.NODE_ENV === 'production') throw new Error(msg);
    console.warn(msg);
  }
  return value;
}

export const BRAND = {
  name: 'ORBIT',
  /** Site reference locale; display texts come from next-intl, not from here. */
  locale: 'en-US',
  direction: 'ltr' as const,
} as const;

export const ENV = {
  mode: (process.env.NODE_ENV ?? 'development') as 'development' | 'production' | 'test',
  isDev: process.env.NODE_ENV !== 'production',
  isProd: process.env.NODE_ENV === 'production',
} as const;

export const API_KEYS = {
  newsApi: readEnv('NEXT_PUBLIC_NEWS_API_KEY'),
} as const;

export const ENDPOINTS = {
  newsApi: 'https://newsapi.org/v2',
  rssFallback: '/api/rss',
} as const;

export const NETWORK = {
  timeoutMs: 12_000,
  retryCount: 3,
  retryDelayMs: 600,
} as const;

export const CACHE = {
  newsTtlMs: 5 * 60 * 1000,
  analyticsTtlMs: 30 * 60 * 1000,
  storagePrefix: 'orbit:',
} as const;

export const NEWS_CATEGORIES = [
  { id: 'ai', color: '#7C3AED' },
  { id: 'gadgets', color: '#06B6D4' },
  { id: 'software', color: '#10B981' },
  { id: 'hardware', color: '#F59E0B' },
  { id: 'security', color: '#EF4444' },
  { id: 'space', color: '#8B5CF6' },
  { id: 'startups', color: '#EC4899' },
] as const;

export type NewsCategoryId = (typeof NEWS_CATEGORIES)[number]['id'];
