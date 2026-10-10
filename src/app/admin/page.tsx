import Link from 'next/link';
import { requireAdmin } from '@/services/admin/adminGuard';
import { applyAdminPageLocale } from '@/services/admin/adminPageLocale';
import { fetchDashboardMetrics } from '@/services/admin/adminQueries';
import { getTranslations } from 'next-intl/server';
import AdminCard from '@/ui/components/admin/AdminCard';
import MetricRing from '@/ui/components/admin/MetricRing';
import AdminLiveClock from '@/ui/components/admin/AdminLiveClock';
import { formatRelative, toDate } from '@/utils/date';

export const dynamic = 'force-dynamic';

/** چیپ «همین حالا» با نقطه زنده پالس‌دار — حس real-time بدون JS. */
function LiveChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
      <span className="admin-live-dot" aria-hidden />
      {label}
    </span>
  );
}

/**
 * نمای کلی — متریک‌ها سمت سرور (RSC)؛ صفر JS کلاینت، صفر waterfall.
 * FIX (UI زنده): سلام شخصی‌سازی‌شده، چیپ وضعیت live، کارت‌های stagger و
 * ردیف میان‌برهای سریع به صفحات پرکاربرد — همان چیزی که یک طراح انسانی
 * روی داشبورد می‌گذارد تا ادمین دو کلیک ذخیره کند.
 */
export default async function AdminHome() {
  // FIX (باگ «تب دیگر = انگلیسی»): applyAdminPageLocale هم resolve می‌کند و هم
  // setRequestLocale می‌کند — تا next-intl در همین request زبان درست را بداند.
  const locale = await applyAdminPageLocale();
  const { supabase, email } = await requireAdmin();
  const [m, t, tp, timeUnits] = await Promise.all([
    fetchDashboardMetrics(supabase),
    getTranslations({ locale, namespace: 'admin.dashboard' }),
    getTranslations({ locale, namespace: 'admin.pages' }),
    getTranslations({ locale, namespace: 'time' }),
  ]);

  // «آخرین همگام‌سازی» — زنده‌ترین متریک شبکه خبری (تازه‌ترین مقاله منتشرشده).
  // FIX (تایپ): واحدها از namespace «time» تزریق می‌شوند تا الگوی مشترک با
  // useFormatters حفظ شود و رشته هاردکد در سرور نباشد؛ lastSyncAt پس از
  // toDate غیرnull است.
  const lastSyncLabel = m.lastSyncAt && toDate(m.lastSyncAt)
    ? formatRelative(m.lastSyncAt, locale, {
        now: timeUnits('now'),
        future: timeUnits('future'),
        minute: timeUnits('minuteAgo'),
        hour: timeUnits('hourAgo'),
        day: timeUnits('dayAgo'),
        month: timeUnits('monthAgo'),
        year: timeUnits('yearAgo'),
      })
    : '—';

  const QUICK: ReadonlyArray<{ href: string; key: 'news' | 'feeds' | 'audit' }> = [
    { href: '/admin/news', key: 'news' },
    { href: '/admin/feeds', key: 'feeds' },
    { href: '/admin/audit', key: 'audit' },
  ];

  return (
    <div className="space-y-6">
      {/* هدر خوش‌آمد — تایپ‌رایتر CSS-only (prefers-reduced-motion در admin.css خاموشش می‌کند) */}
      <header className="admin-rise space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300/70">{t('title')}</p>
          <span className="ms-auto"><AdminLiveClock /></span>
        </div>
        <h1 dir={email ? 'ltr' : undefined} className="max-w-fit text-2xl font-bold text-cyan-100 sm:text-3xl">
          <span className="admin-typewriter inline-block">{t('greeting.hello', { email: email ?? '—' })}</span>
        </h1>
        <p className="text-sm text-slate-400">{t('greeting.sub')}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <AdminCard title={t('totalArticles')} tone="metric" delay={1}>
          <MetricRing label={t('manualArticles', { count: m.totalArticles })} value={m.totalArticles} pct={Math.min(1, m.totalArticles / 50)} color="#22d3ee" />
        </AdminCard>
        <AdminCard title={t('activeUsers')} tone="metric" delay={2}>
          <MetricRing label={t('usersActive24h', { total: m.totalUsers })} value={m.active24h} pct={m.totalUsers ? m.active24h / m.totalUsers : 0} color="#e879f9" />
        </AdminCard>
        <AdminCard title={t('systemStatus')} tone="metric" delay={3} aside={<LiveChip label={t('liveNow')} />}>
          <div className="flex items-center gap-3">
            <span role="status" aria-label={t('rssHealthy')} className="admin-live-dot" />
            <p className="text-sm text-slate-300">{t('rssHealthy')}<br /><span dir="ltr" className="text-xs text-slate-500">{t('signedInAs', { email: email ?? '—' })}</span></p>
          </div>
          {/* FIX (UI زنده): «آخرین همگام‌سازی» — تازه‌ترین مقاله منتشرشده؛ ادمین
              در یک نگاه می‌فهمد شبکه خبری واقعاً زنده است یا گیر کرده. */}
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
            <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
            {t('lastSync')}: <span className="font-semibold text-cyan-200">{lastSyncLabel}</span>
          </p>
        </AdminCard>
      </div>

      {/* میان‌برها — طراح واقعی هیچ داشبوردی را بدون دسترسی سریع رها نمی‌کند.
          PERF: prefetch={true} پayload RSC هر سه مسیر پرکاربرد را بی‌درنگ پس از
          رندر داشبورد آماده می‌کند؛ اولین کلیک کاربر تقریباً آنی سوییچ می‌کند
          (قبلاً همان کلیک = رندر کامل سمت سرور با گارد + کوئری‌ها). */}
      <nav aria-label={t('title')} className="admin-rise admin-rise-4 grid gap-3 sm:grid-cols-3">
        {QUICK.map((q) => (
          <Link key={q.href} href={q.href} prefetch
            className="admin-card group flex items-center justify-between gap-2 px-4 py-3 text-sm text-slate-200">
            <span>{tp(q.key)}</span>
            <span aria-hidden className="text-cyan-300 opacity-0 transition-opacity group-hover:opacity-100">→</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
