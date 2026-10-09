import { requireAdmin } from '@/services/admin/adminGuard';
import { adminPageTranslations } from '@/services/admin/adminPageLocale';
import { fetchProfiles } from '@/services/admin/adminQueries';
import UsersTable from '@/ui/components/admin/UsersTable';
import AdminPageHeader from '@/ui/components/admin/AdminPageHeader';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  // FIX (باگ «عنوان انگلیسی، بقیه فارسی»): ترجمه با locale صریح — helper مشترک پنل.
  const { supabase, userId } = await requireAdmin();
  const [profiles, t] = await Promise.all([
    fetchProfiles(supabase),
    adminPageTranslations('admin.users'),
  ]);
  return (
    <div className="space-y-6">
      <AdminPageHeader eyebrow={t('title')} title={t('title')} chip={t('countUsers', { count: profiles.length })} />
      <UsersTable users={profiles} selfId={userId} />
    </div>
  );
}
