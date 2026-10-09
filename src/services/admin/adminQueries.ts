import { revalidatePath } from 'next/cache';
import type { AdminSupabase } from './serverClient';
// SECURITY/STALENESS: cacheService یک Map ماژول-اسکوپ است (بدون next/headers)؛
// import مستقیم آن اینجا زنجیره build را نمی‌شکند و به‌جای exportِ کش خصوصی
// در newsService، منبع واحد «چگونه پاک کنیم» باقی می‌ماند.
import { invalidateNewsCaches } from '@/services/news/newsService';

export interface ArticleRow {
  id: string; title: string; summary: string; category: string;
  source_name: string; url: string; image_url: string | null;
  published_at: string; is_published: boolean;
}
export interface ProfileRow {
  id: string; email: string | null; role: string; status: string; last_login: string | null;
}
export interface AuditRow {
  id: number; actor_id: string; action: string; target: string | null;
  meta: Record<string, unknown> | null; created_at: string;
}

/** همه کوئری‌ها فقط ستون‌های موردنیاز (بدون select('*')) — فاز ۲ بهینگی. */
export async function fetchDashboardMetrics(supa: AdminSupabase) {
  const [articles, users, active24h] = await Promise.all([
    // FIX — آمار اشتباه داشبورد: بدون فیلتر، پیش‌نویس‌های is_published=false هم
    // شمرده می‌شدند. متریک باید فقط مقالات منتشرشده را نشان دهد.
    supa.from('articles').select('id', { count: 'exact', head: true }).eq('is_published', true),
    // FIX (پایداری): نبود جدول/ستون profiles.last_login (migration کامل اجرا
    // نشده) نباید داشبورد را با NaN/خطا منفجر کند؛ هر شاخه null → صفر.
    supa.from('profiles').select('id', { count: 'exact', head: true }),
    // FIX — نبود ستون last_login در اسکیمای دستی profiles (تریگر handle_new_user
    // آن را نمی‌سازد) باعث 400/NaN در داشبورد می‌شد. فعالیت ۲۴ ساعته از
    // auth.users.last_sign_in_at خوانده می‌شود که همیشه موجود و دقیق‌تر است.
    // FIX (باگ متریک): admin.listUsers فقط با service_role کار می‌کند و با anon
    // همیشه خطا → .catch(()=>0) داشت؛ یعنی active24h «همیشه صفر». حالا از RPC
    // جدید rpc_active_users_24h استفاده می‌شود که داخل Postgres (SECURITY
    // DEFINER، ادمین-محور) شمارش را انجام می‌دهد — بدون نیاز به کلید سرویس.
    supa.rpc('rpc_active_users_24h').then((res) =>
      typeof res.data === 'number' ? res.data : 0,
    ),
  ]);
  // FIX (کلیدهای ترجمه مرده): lastSync در داشبورد استفاده شد — تازه‌ترین
  // مقاله منتشرشده به‌عنوان «آخرین همگام‌سازی شبکه خبری». سقف یک ردیف، ارزان.
  const latest = await supa
    .from('articles')
    .select('published_at')
    .eq('is_published', true)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  // FIX (تایپ): maybeSingle در حالت failure ممکن است undefined باشد؛ با optional chaining.
  return {
    totalArticles: articles?.count ?? 0,
    totalUsers: users?.count ?? 0,
    active24h: typeof active24h === 'number' ? active24h : 0,
    lastSyncAt: latest?.data?.published_at ?? null,
  };
}

export async function fetchRecentArticles(supa: AdminSupabase): Promise<ArticleRow[]> {
  const { data } = await supa
    .from('articles')
    .select('id,title,summary,category,source_name,url,image_url,published_at,is_published')
    .order('published_at', { ascending: false })
    .limit(50);
  return (data as ArticleRow[] | null) ?? [];
}

export async function fetchProfiles(supa: AdminSupabase): Promise<ProfileRow[]> {
  // فهرست کامل فقط از طریق RPC ادمین (RLS جدول self-select است)
  const { data } = await supa.rpc('rpc_list_profiles');
  return (data as ProfileRow[] | null) ?? [];
}

/**
 * لاگ ممیزی — فقط از RPC ادمین (SECURITY DEFINER با چک is_admin()).
 * FIX (پایداری): اگر migration مربوطه هنوز روی پروژه اعمال نشده باشد، Supabase
 * به‌جای error یک پاسخ 200 با body null برمی‌گرداند — اینجا هر دو حالت به لیست
 * خالی تبدیل می‌شوند تا صفحه هرگز نکند.
 */
export async function fetchAuditLog(supa: AdminSupabase, limit = 50): Promise<AuditRow[]> {
  try {
    const { data } = await supa.rpc('rpc_audit_log', { p_limit: Math.min(Math.max(limit, 1), 200) });
    return (data as AuditRow[] | null) ?? [];
  } catch {
    return [];
  }
}

export type UpsertResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string };

export async function upsertArticle(supa: AdminSupabase, payload: Record<string, unknown>): Promise<UpsertResult> {
  // FIX — rpc حالا { id } برمی‌گرداند؛ کلاینت برای هم‌ردیف‌ماندن با ردیف
  // سرور به همین id واقعی نیاز دارد (id ساختگی → مقاله تکراری در ادیت).
  // اگر migration نسخه جدید اعمال نشده باشد، data=null است و مسیر قدیمی کار می‌کند.
  const { data, error } = await supa.rpc('rpc_upsert_article', { payload });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/'); // فید عمومی بلافاصله به‌روز شود
  invalidateNewsCaches(); // + کش in-process مقالات دستی/فید (وگرنه تا ۵ دقیقه stale)
  const id = typeof data === 'string' ? data : (data as { id?: unknown } | null)?.id ?? null;
  return { ok: true, id: typeof id === 'string' && id ? id : null };
}

export async function deleteArticle(supa: AdminSupabase, id: string) {
  const { error } = await supa.rpc('rpc_delete_article', { p_id: id });
  if (!error) {
    revalidatePath('/');
    invalidateNewsCaches();
  }
  return error?.message ?? null;
}

export async function setUserStatus(supa: AdminSupabase, userId: string, status: 'active' | 'banned') {
  const { error } = await supa.rpc('rpc_set_user_status', { p_user_id: userId, p_status: status });
  return error?.message ?? null;
}
