// src/services/news/feedSources.ts — خواندن فهرست فیدهای RSS از دیتابیس
// این ماژول عمداً «بدون next/cache و بدون نوشتن» است تا بتواند در گراف
// Client Components (زنجیره newsStore → feeds.server) بدون خطای build وارد
// شود؛ توابع ادمینِ نوشتاری در feedAdmin.ts باقی مانده‌اند.
import type { SupabaseClient } from '@supabase/supabase-js';

/** حداقل‌تایپ لازم برای فراخوانی RPCها — بدون import از serverClient (گراف کلاینت). */
type FeedRpcClient = Pick<SupabaseClient, 'rpc'>;
import { ALLOWED_FEED_HOSTS } from './feedCore';
import { safeFeedUrl } from './articleNormalizer';

export interface FeedSourceRow {
  id?: string; url: string; label: string; enabled: boolean; created_at?: string;
}

const FEEDS_TTL_MS = 60_000;
let feedsCache: { rows: FeedSourceRow[]; at: number } | null = null;

/** لیست فیدها (ادمین: کامل با id؛ خطا → خالی، صفحه نمی‌شکند). */
export async function fetchFeedSources(supa: FeedRpcClient, fresh = false): Promise<FeedSourceRow[]> {
  if (!fresh && feedsCache && Date.now() - feedsCache.at < FEEDS_TTL_MS) return feedsCache.rows;
  try {
    const { data } = await supa.rpc('rpc_list_feeds');
    const rows = (data as FeedSourceRow[] | null) ?? [];
    feedsCache = { rows, at: Date.now() };
    return rows;
  } catch {
    return feedsCache?.rows ?? [];
  }
}

/** آدرس‌های فعالی که رن‌تایم اجازه fetch دارد = DB(enabled) ∩ allowlist کد. */
export async function getRuntimeFeedUrls(supa: FeedRpcClient): Promise<string[] | null> {
  const rows = await fetchFeedSources(supa);
  if (rows.length === 0) return null; // table empty/migration missing → caller uses code defaults
  const urls = rows
    .filter((r) => r.enabled !== false)
    .map((r) => safeFeedUrl(r.url, ALLOWED_FEED_HOSTS))
    .filter((u): u is string => !!u);
  return urls.length > 0 ? urls : null;
}

/** پاک‌سازی کش in-process فهرست فیدها (بعد از نوشتن ادمین). */
export function clearFeedSourcesCache(): void {
  feedsCache = null;
}
