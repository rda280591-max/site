// ORBIT — تنظیمات مرکزی
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
  tagline: 'مرکز فرماندهی شخصی شما در مدار تکنولوژی',
  locale: 'fa-IR',
  direction: 'rtl' as const,
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

export const UI = {
  pageSize: 20,
  maxNotesPerPage: 50,
  animationDurationMs: 220,
} as const;

export const NEWS_CATEGORIES = [
  { id: 'ai', label: 'هوش مصنوعی', color: '#7C3AED' },
  { id: 'gadgets', label: 'گجت‌ها', color: '#06B6D4' },
  { id: 'software', label: 'نرم‌افزار', color: '#10B981' },
  { id: 'hardware', label: 'سخت‌افزار', color: '#F59E0B' },
  { id: 'security', label: 'امنیت', color: '#EF4444' },
  { id: 'space', label: 'فضا و علم', color: '#8B5CF6' },
  { id: 'startups', label: 'استارتاپ‌ها', color: '#EC4899' },
] as const;

export type NewsCategoryId = (typeof NEWS_CATEGORIES)[number]['id'];

export const Config = {
  brand: BRAND,
  env: ENV,
  apiKeys: API_KEYS,
  endpoints: ENDPOINTS,
  network: NETWORK,
  cache: CACHE,
  ui: UI,
  categories: NEWS_CATEGORIES,
} as const;

export default Config;