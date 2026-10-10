'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin, invalidateAdminSessionCache, type AdminContext } from './adminGuard';
import { upsertArticle, deleteArticle, setUserStatus } from './adminQueries';
import { createRateLimiter, ipKey } from '@/core/rateLimit';
import { safeHttpUrl } from '@/services/news/articleNormalizer';
import { fetchFeedWork } from '@/services/news/feedCore';
import { headers } from 'next/headers';

/** سقف حجم payload هر اکشن (جلوگیری از تزریق بدنه غول‌پیکر) */
const MAX_BODY = 100_000;

/**
 * FIX — اکشن‌های نوشتاری هرگز نباید با ctx حالت «تشخیصی» (supabase=null که
 * فقط برای صفحه /admin/access ساخته می‌شود) ادامه دهند؛ این تابع گارد نوعی
 * سرور-ساید است و در صورت غیرمنتظره‌بودن، همان‌جا رد می‌کند.
 */
async function requireWritable(): Promise<AdminContext> {
  const ctx = await requireAdmin();
  if (!ctx.supabase) throw new Error('forbidden');
  // PERF/SEC — هر نوشتن ادمین، کش اعتبارسنجی نشست را بی‌اعتبار می‌کند؛ اگر
  // اکشنی نقش/وضعیت کاربر را عوض کرده باشد (banUserAction)، فریم بعدی حتماً
  // از سرور بازبررسی می‌شود و پنجره TTL به «چند ثانیه روی همان instance» محدود
  // می‌ماند نه بیشتر.
  invalidateAdminSessionCache(ctx.userId);
  return ctx;
}


/**
 * FIX — DoS متقابل اکشن‌ها: limiter مشترک قبلاً باعث می‌شد یک کاربر با ۲۰
 * پیش‌نمایش فید، سقف «ذخیره مقاله» را هم پر کند و قلم‌های حیاتی‌تر تا یک
 * دقیقه قفل شوند. حالا بودجه per-action (per-IP) است:
 *  - write-heavy (save/delete/feed writes): 30/دقیقه
 *  - read-ish (preview/purge/toggle): 60/دقیقه
 */
const writeLimiter = createRateLimiter(30, 60);
const lightLimiter = createRateLimiter(60, 60);

/**
 * FIX — گارد Origin برای Server Actions (محافظت CSRF لایه HTTP): Next.js فقط
 * روی Route Handlers_origin check_ ندارد؛ اگر reverse-proxy هدر Origin را
 * drop کند، درخواست بدون-Origin پذیرفته می‌شود. اینجا مبدأ را از host خودِ
 * URL درخواست (کنترل‌شده توسط سرور) می‌سازیم و هر Origin مغایر را رد می‌کنیم.
 */
async function sameOriginOk(): Promise<boolean> {
  const h = await headers();
  const origin = h.get('origin');
  // FIX (CSRF hardening): Origin absent ⇒ not a modern top-level browser POST.
  // Server Actions always send Sec-Fetch-* metadata; require SameSite=nested for
  // them and reject requests that look like cross-site navigations. Legacy
  // non-browser callers (curl/tests) keep working via the Sec-Fetch absence path.
  if (!origin) {
    const site = h.get('sec-fetch-site');
    if (site && site !== 'same-origin' && site !== 'same-site') return false;
    return true; // no browser context at all (server-to-server invocation)
  }
  try {
    const host = h.get('x-forwarded-host')?.split(',')[0]?.trim() || h.get('host');
    const proto = h.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https';
    if (!host) return false;
    return new URL(origin).host === host && new URL(origin).protocol === `${proto}:`;
  } catch {
    return false;
  }
}

function validateArticle(a: Record<string, unknown>): string | null {
  if (typeof a.title !== 'string' || a.title.trim().length < 3 || a.title.length > 300) return 'invalid title';
  if (typeof a.url !== 'string') return 'invalid url';
  // SECURITY — رفع دورزدن blocklist: قبلاً فقط regex «\d+.\d+.\d+.\d+» چک می‌شد؛
  // آدرس‌های عددی دهدهی (https://1677721694 → 127.0.0.1)، هگز/اکتال، localhost
  // و metadata سرویس‌ها از آن رد می‌شدند. حالا با پارسر واقعی + فیلتر کامل.
  if (!safeHttpUrl(a.url)) return 'url must be a public https address';
  // image_url هم همان فیلتر را می‌گذراند (اختیاری است؛ اگر داد، باید امن باشد)
  if (typeof a.image_url === 'string' && a.image_url.length > 0 && !safeHttpUrl(a.image_url)) {
    return 'image_url must be a public https address';
  }
  if (typeof a.summary === 'string' && a.summary.length > 1000) return 'summary too long';
  if (typeof a.body === 'string' && a.body.length > MAX_BODY) return 'body too large';
  return null;
}

export async function saveArticleAction(
  input: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string; id?: string | null }> {
  if (!(await sameOriginOk())) return { ok: false, error: 'forbidden origin' };
  const h = await headers();
  if (!writeLimiter.check(ipKey(h)).allowed) return { ok: false, error: 'rate_limited' };
  const err = validateArticle(input);
  if (err) return { ok: false, error: err };
  const { supabase } = await requireWritable();
  const res = await upsertArticle(supabase, input);
  // FIX — id واقعیِ ذخیره‌شده به کلاینت برمی‌گردد تا ردیف local با ردیف سرور
  // هم‌کلید بماند (قبلاً id ساختگی باعث مقاله تکراری هنگام ادیت می‌شد).
  return res.ok ? { ok: true, id: res.id } : { ok: false, error: res.error };
}

/**
 * پیش‌نمایش زنده یک فید RSS — فقط برای ادمین (اکشن گاردشده).
 * FIX (امنیت): fetch مستقیم در این لایه انجام نمی‌شود؛ از fetchFeedWork استفاده
 * می‌کند که allowlist دامنه + سقف حجم + محدودیت ریدایرکت (SSRF guard) را اعمال
 * می‌کند. نتیجه فقط «تعداد آیتم» به UI برمی‌گردد، نه محتوای خام.
 */
export async function previewFeedAction(feedUrl: string): Promise<{ ok: boolean; count?: number; error?: string }> {
  if (!(await sameOriginOk())) return { ok: false, error: 'forbidden origin' };
  const h = await headers();
  if (!lightLimiter.check(ipKey(h)).allowed) return { ok: false, error: 'rate_limited' };
  await requireWritable(); // خطا → redirect('/'); هرگز اجرا نمی‌شود اگر ادمین نباشد

  const url = typeof feedUrl === 'string' ? feedUrl.trim() : '';
  if (!/^https:\/\/[^\s]+$/i.test(url)) return { ok: false, error: 'invalid url' };
  try {
    const payload = await fetchFeedWork(url);
    if (payload.error) return { ok: false, error: `feed_${payload.status}` };
    return { ok: true, count: payload.items?.length ?? 0 };
  } catch {
    return { ok: false, error: 'fetch_failed' };
  }
}

/** FIX — حذف مقاله هم error برمی‌گرداند (قبلاً ok:true کاذب هنگام خطای RPC). */
export async function deleteArticleAction(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await sameOriginOk())) return { ok: false, error: 'forbidden origin' };
  if (typeof id !== 'string' || id.length > 80) return { ok: false, error: 'bad id' };
  const h = await headers();
  if (!writeLimiter.check(ipKey(h)).allowed) return { ok: false, error: 'rate_limited' };
  const { supabase } = await requireWritable();
  const message = await deleteArticle(supabase, id);
  return message ? { ok: false, error: message } : { ok: true };
}

/**
 * FIX — بن‌کردن بی‌صدا شکست می‌خورد: setUserStatus خطا را برمی‌گرداند ولی
 * اکشن آن را دور می‌ریخت و UI موفقیت نشان می‌داد (کاربرِ «بن‌شده» همچنان
 * لاگین می‌کرد). حالا پیام واقعی به جدول کاربران می‌رسد.
 */
export async function banUserAction(userId: string, banned: boolean): Promise<{ ok: boolean; error?: string }> {
  if (!(await sameOriginOk())) return { ok: false, error: 'forbidden origin' };
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (typeof userId !== 'string' || !UUID_RE.test(userId)) return { ok: false, error: 'bad id' };
  const h = await headers();
  if (!writeLimiter.check(ipKey(h)).allowed) return { ok: false, error: 'rate_limited' };
  const { supabase, userId: me } = await requireWritable();
  if (userId === me) return { ok: false, error: 'cannot ban yourself' }; // ادمین نتواند خودش را بن کند
  const message = await setUserStatus(supabase, userId, banned ? 'banned' : 'active');
  return message ? { ok: false, error: message } : { ok: true };
}

/* ────────── پنل ادمین پیشرفته — فیدهای RSS + پاک‌سازی کش ────────── */

/** افزودن فید RSS (اعتبارسنجی امنیتی سمت سرور: allowlist + SSRF guard). */
export async function addFeedAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  if (!(await sameOriginOk())) return { ok: false, error: 'forbidden origin' };
  const h = await headers();
  if (!writeLimiter.check(ipKey(h)).allowed) return { ok: false, error: 'rate_limited' };
  const { supabase } = await requireWritable();
  const url = String(formData.get('url') ?? '').trim().slice(0, 512);
  const label = String(formData.get('label') ?? '').trim().slice(0, 80);
  if (!url) return { ok: false, error: 'missing url' };
  const { addFeedSource } = await import('./feedAdmin');
  const err = await addFeedSource(supabase, url, label);
  return err ? { ok: false, error: err } : { ok: true };
}

/** فعال/غیرفعال کردن فید (soft delete). */
export async function toggleFeedAction(id: string, enabled: boolean): Promise<{ ok: boolean; error?: string }> {
  if (!(await sameOriginOk())) return { ok: false, error: 'forbidden origin' };
  const h = await headers();
  if (!lightLimiter.check(ipKey(h)).allowed) return { ok: false, error: 'rate_limited' };
  const { supabase } = await requireWritable();
  const { setFeedEnabled } = await import('./feedAdmin');
  const err = await setFeedEnabled(supabase, id, enabled);
  return err ? { ok: false, error: err } : { ok: true };
}

/**
 * پاک‌سازی دستی تمام کش‌های خبری این instance (فید خام + مقالات نرمال‌شده +
 * prefetch) و revalidate مسیر عمومی. پس از تغییر فیدها یا انتشار مقاله کاربرد
 * دارد؛ در serverless فقط روی instance جاری اثر دارد و بقیه با TTL خودشان
 * تازه می‌شوند — عمداً بی‌خطر و idempotent است.
 * FIX — ثبت در لاگ ممیزی: فراخوانی rpc_purge_cache (migration 0007) که ردپای
 * cache.purge را می‌نویسد؛ خطای نبودِ migration کش را نمی‌شکند اما لاگ می‌شود.
 */
export async function purgeCacheAction(): Promise<{ ok: boolean; error?: string }> {
  if (!(await sameOriginOk())) return { ok: false, error: 'forbidden origin' };
  const h = await headers();
  if (!lightLimiter.check(ipKey(h)).allowed) return { ok: false, error: 'rate_limited' };
  const { supabase } = await requireWritable();
  // FIX (UX/پایداری): قبلاً این اکشن فقط کش instance جاری را پاک می‌کرد و
  // revalidatePath('/') مسیر ریشه — یعنی صفحات /news و جزئیات مقالات تا TTL
  // خودشان کهنه می‌ماندند و ادمین «Purge» را بی‌اثر می‌دید. حالا هر دو صفحه
  // پرکاربرد عمومی هم revalidate می‌شوند.
  const { invalidateNewsCaches } = await import('@/services/news/newsService');
  const { clearFeedPrefetchCache } = await import('@/services/news/feeds.server');
  invalidateNewsCaches();
  clearFeedPrefetchCache();
  revalidatePath('/');
  revalidatePath('/news');
  try {
    const { error } = await supabase.rpc('rpc_purge_cache');
    if (error) console.warn('[adminActions] rpc_purge_cache audit failed:', error.message);
  } catch {
    /* best-effort audit — never block the purge itself */
  }
  return { ok: true };
}

/**
 * پیشنهاد بهبود (قابلیت): force-sync دستی فیدها. قبلاً تغذیه فیدها فقط با
 * cron/Vercel Scheduler انجام می‌شد و ادمین پس از افزودن فید جدید باید تا
 * نوبت بعدی scheduler صبر می‌کرد. این اکشن همان fetchFeedWork را برای همه
 * منابع فعال اجرا و کش را می‌سوزاند — نتیجه فقط شمارش به UI برمی‌گردد
 * (بدون افشای محتوای خام).
 */
export async function syncFeedsNowAction(): Promise<{ ok: boolean; synced?: number; error?: string }> {
  if (!(await sameOriginOk())) return { ok: false, error: 'forbidden origin' };
  const h = await headers();
  // write-heavy: هر sync چند fetch خارجی است → بودجه جدا و سخت‌گیرانه
  if (!writeLimiter.check(ipKey(h)).allowed) return { ok: false, error: 'rate_limited' };
  const { supabase } = await requireWritable();
  const { fetchFeedSources } = await import('@/services/news/feedSources');
  const sources = await fetchFeedSources(supabase, true);
  let synced = 0;
  for (const s of sources.slice(0, 10)) {
    try {
      const payload = await fetchFeedWork(s.url);
      if (!payload.error) synced += 1;
    } catch {
      /* خطای یک فید نباید بقیه را متوقف کند */
    }
  }
  const { invalidateNewsCaches } = await import('@/services/news/newsService');
  invalidateNewsCaches();
  revalidatePath('/');
  revalidatePath('/news');
  return { ok: true, synced };
}
