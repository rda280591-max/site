import { requireAdmin } from '@/services/admin/adminGuard';
import { adminPageTranslations } from '@/services/admin/adminPageLocale';
import Link from 'next/link';
import AdminPageHeader from '@/ui/components/admin/AdminPageHeader';
import AdminCard from '@/ui/components/admin/AdminCard';

export const dynamic = 'force-dynamic';

/** راهنمای عملیاتی پنل + نحوه اعطای نقش (بدون ریسک: تغییر نقش فقط از SQL Editor). */
export default async function AdminSettingsPage() {
  // FIX (باگ «عنوان انگلیسی، بقیه فارسی»): ترجمه با locale صریح — helper مشترک پنل.
  const { email } = await requireAdmin();
  // FIX (دوزبانه‌سازی): همه متن‌ها از admin.messages؛ قبلاً نصف صفحه فارسی ثابت بود.
  const t = await adminPageTranslations('admin.settings');
  return (
    <div className="max-w-2xl space-y-6">
      <AdminPageHeader eyebrow={t('title')} title={t('title')} />
      <AdminCard title={t('grantTitle')} delay={1}>
        <p className="mb-3 text-sm text-slate-300">
          {t('grantIntro', { email: email ?? '—' })}
        </p>
        <pre dir="ltr" className="overflow-x-auto rounded-lg border border-white/10 bg-black/50 p-3 text-xs leading-relaxed text-emerald-300"><code>{`UPDATE public.profiles SET role='admin'\nWHERE id='<user-uuid>';\n-- or promote by email:\nUPDATE public.profiles SET role='admin' WHERE email='you@example.com';`}</code></pre>
        <p className="mt-3 text-xs text-slate-500">{t('grantNote')}</p>
      </AdminCard>
      <AdminCard title={t('securityTitle')} delay={2}>
        <ul className="list-disc space-y-1.5 ps-5 pe-0 text-sm text-slate-300 marker:text-fuchsia-400/60">
          <li>{t('sec1')}</li>
          <li>{t('sec2')}</li>
          <li>{t('sec3')}</li>
          <li>{t('sec4')}</li>
        </ul>
      </AdminCard>
      <AdminCard title={t('appearanceTitle')} delay={3}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">{t('themeNote')}</p>
          <Link href="/" className="rounded-lg border border-cyan-400/40 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/10">
            {t('backToSite')}
          </Link>
        </div>
      </AdminCard>
    </div>
  );
}
