// src/services/admin/feedAdmin.ts — مدیریت فیدهای RSS از پنل ادمین (فقط نوشتن)
// داده در جدول feed_sources (migration 0004) است؛ نوشتن فقط از RPC های
// SECURITY DEFINER با چک is_admin(). خواندن‌های رن‌تایم/صفحه در
// @/services/news/feedSources زندگی می‌کنند تا گراف Client Components هرگز
// وارد next/cache نشود (خطای build Turbopack).
import { revalidatePath } from 'next/cache';
import type { AdminSupabase } from './serverClient';
import { ALLOWED_FEED_HOSTS } from '@/services/news/feedCore';
import { safeFeedUrl } from '@/services/news/articleNormalizer';
import { clearFeedSourcesCache } from '@/services/news/feedSources';

/** پاک‌سازی کش‌های in-process خبری (dynamic import: جلوگیری از ورود newsService به گراف کلاینت). */
async function invalidateNews(): Promise<void> {
  const { invalidateNewsCaches } = await import('@/services/news/newsService');
  invalidateNewsCaches();
}

export async function addFeedSource(supa: AdminSupabase, url: string, label: string): Promise<string | null> {
  // اعتبارسنجی برنامه‌ای قبل از DB — allowlist کد، همان چیزی که پروکسی رعایت می‌کند
  const clean = safeFeedUrl(url, ALLOWED_FEED_HOSTS);
  if (!clean) return 'domain not in allowed feed list';
  const { error } = await supa.rpc('rpc_add_feed', { p_url: clean, p_label: label.slice(0, 80) });
  if (!error) {
    clearFeedSourcesCache();
    await invalidateNews();
    revalidatePath('/');
  }
  return error?.message ?? null;
}

export async function setFeedEnabled(supa: AdminSupabase, id: string, enabled: boolean): Promise<string | null> {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(id)) return 'bad id';
  const { error } = await supa.rpc('rpc_set_feed_enabled', { p_id: id, p_enabled: enabled });
  if (!error) {
    clearFeedSourcesCache();
    await invalidateNews();
    revalidatePath('/');
  }
  return error?.message ?? null;
}

/** فهرست پیش‌فرض کد — وقتی migration هنوز اعمال نشده، در UI به‌عنوان «built-in» نشان داده می‌شود. */
export { DEFAULT_FEEDS as BUILTIN_FEED_URLS } from '@/services/news/rssProvider';
