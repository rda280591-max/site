import { requireAdmin } from '@/services/admin/adminGuard';
import { adminPageTranslations } from '@/services/admin/adminPageLocale';
import { BUILTIN_FEED_URLS } from '@/services/admin/feedAdmin';
import { fetchFeedSources } from '@/services/news/feedSources';
import FeedsManager from '@/ui/components/admin/FeedsManager';
import AdminPageHeader from '@/ui/components/admin/AdminPageHeader';

export const dynamic = 'force-dynamic';

/**
 * مدیریت فیدهای RSS — منابع فعال از جدول feed_sources (migration 0004).
 * اگر migration هنوز اعمال نشده باشد، فهرست built-in کد به‌صورت read-only
 * نمایش داده می‌شود تا صفحه هرگز خالی/شکسته نباشد.
 */
export default async function AdminFeedsPage() {
  // PERF — موازی‌سازی: ترجمه (این‌موری/کش) در کنار requireAdmin اجرا می‌شود؛
  // قبلاً سریال بود و هر سوییچ تب چند صد ms اضافه می‌برد.
  const [{ supabase }, tf] = await Promise.all([
    requireAdmin(),
    // FIX (باگ «عنوان انگلیسی، بقیه فارسی»): ترجمه با locale صریح — helper مشترک پنل.
    adminPageTranslations('admin.feeds'),
  ]);
  let rows = await fetchFeedSources(supabase, true);
  if (rows.length === 0) {
    // fallback خواندنی: پیش‌فرض‌های کد (بدون id → بدون دکمه toggle)
    rows = BUILTIN_FEED_URLS.map((url) => ({ url, label: 'built-in', enabled: true }));
  }
  return (
    <div className="space-y-6">
      <AdminPageHeader eyebrow={tf('title')} title={tf('title')} subtitle={tf('subtitle')} chip={tf('countFeeds', { count: rows.filter((r) => r.enabled).length })} />
      <FeedsManager feeds={rows} />
    </div>
  );
}
