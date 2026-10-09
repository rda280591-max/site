import { requireAdmin } from '@/services/admin/adminGuard';
import { adminPageTranslations } from '@/services/admin/adminPageLocale';
import { fetchRecentArticles } from '@/services/admin/adminQueries';
import NewsManager from '@/ui/components/admin/NewsManager';
import AdminPageHeader from '@/ui/components/admin/AdminPageHeader';

export const dynamic = 'force-dynamic';

/** لیست مقالات دستی — داده در RSC می‌آید؛ فقط فرم/اکشن‌ها client هستند. */
export default async function AdminNewsPage() {
  // FIX (باگ «عنوان انگلیسی، بقیه فارسی»): ترجمه با locale صریح — helper مشترک
  // پنل؛ عنوان هرگز از زبان Provider جدا نمی‌افتد.
  const { supabase } = await requireAdmin();
  const [articles, t] = await Promise.all([
    fetchRecentArticles(supabase),
    adminPageTranslations('admin.news'),
  ]);
  return (
    <div className="space-y-6">
      <AdminPageHeader eyebrow={t('title')} title={t('title')} chip={t('countArticles', { count: articles.length })} />
      <NewsManager articles={articles} />
    </div>
  );
}
