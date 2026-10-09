import { requireAdmin } from '@/services/admin/adminGuard';
import { adminPageTranslations } from '@/services/admin/adminPageLocale';
import { fetchAuditLog } from '@/services/admin/adminQueries';
import AuditTable from '@/ui/components/admin/AuditTable';
import AdminPageHeader from '@/ui/components/admin/AdminPageHeader';

export const dynamic = 'force-dynamic';

/**
 * لاگ ممیزی — آخرین ۱۰۰ رویداد نوشتاری ادمین (مقالات، کاربران، فیدها، پاک‌سازی
 * کش). خواندن فقط از RPC ادمین؛ نبودِ migration → لیست خالی (صفحه نمی‌شکند).
 */
export default async function AdminAuditPage() {
  // FIX (باگ «عنوان انگلیسی، بقیه فارسی»): ترجمه با locale صریح — helper مشترک پنل.
  const { supabase } = await requireAdmin();
  const [rows, t] = await Promise.all([
    fetchAuditLog(supabase, 100),
    adminPageTranslations('admin.audit'),
  ]);
  return (
    <div className="space-y-6">
      <AdminPageHeader eyebrow={t('title')} title={t('title')} subtitle={t('subtitle')} chip={t('countEvents', { count: rows.length })} />
      <AuditTable rows={rows} />
    </div>
  );
}
