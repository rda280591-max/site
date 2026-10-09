'use client';

import { useTransition, useState } from 'react';
import { useTranslations } from 'next-intl';
import Icon from '@/ui/components/atoms/Icon';
import AdminStatusBanner, { type AdminMsg } from './AdminStatusBanner';
import {
  addFeedAction,
  toggleFeedAction,
  purgeCacheAction,
  previewFeedAction,
  syncFeedsNowAction,
} from '@/services/admin/adminActions';

export interface FeedRow {
  id?: string;
  url: string;
  label: string;
  enabled: boolean;
}

/** FIX — نگاشت کد خطای سرور به پیام خوانا برای ادمین (قبلاً همه خطاها بی‌صدا بودند).
 * FIX (دوزبانه‌سازی): پیام‌ها از admin.feeds در messages/admin.json می‌آیند. */
function feedErrorMessage(t: ReturnType<typeof useTranslations>, err: string | undefined): string {
  switch (err) {
    case 'rate_limited': return t('errRateLimited');
    case 'forbidden origin': return t('errForbiddenOrigin');
    case 'domain_not_allowed': return t('errDomain');
    case 'missing url': return t('errMissingUrl');
    default: return err ? `${t('errGeneric')} (${err})` : t('errGeneric');
  }
}

/**
 * مدیریت فیدهای RSS — افزودن/غیرفعال‌سازی (soft delete) + پاک‌سازی کش فید.
 * نوشتن فقط از Server Action با گارد ادمین + Rate Limit؛ دامنه‌ها در سمت
 * سرور با allowlist و SSRF guard اعتبارسنجی می‌شوند (اینجا فقط UX).
 * FIX — نتیجه هر اکشن (شامل رد شدن توسط allowlist/SSRF/rate-limit) حالا در
 * بنر role="status" نمایش داده می‌شود؛ قبلاً `await action()` بدون بررسی r.ok.
 */
export default function FeedsManager({ feeds }: { feeds: FeedRow[] }) {
  const t = useTranslations('admin.feeds');
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<AdminMsg | null>(null);
  const list: FeedRow[] = Array.isArray(feeds) ? feeds : [];

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) {
    try {
      const r = await fn();
      setMsg(r.ok ? { kind: 'ok', text: okText } : { kind: 'err', text: feedErrorMessage(t, r.error) });
    } catch (e) {
      setMsg({ kind: 'err', text: feedErrorMessage(t, e instanceof Error ? e.message : undefined) });
    }
  }

  function add(formData: FormData) {
    start(() => run(() => addFeedAction(formData), t('msgAdded')));
  }
  function toggle(id: string, enabled: boolean) {
    start(() => run(() => toggleFeedAction(id, !enabled), enabled ? t('okToggledOff') : t('okToggledOn')));
  }
  function purge() {
    start(() => run(purgeCacheAction, t('msgPurgedLong')));
  }
  /** پیشنهاد بهبود: همگام‌سازی فوری فیدها بدون انتظار برای scheduler بعدی. */
  function syncNow() {
    start(async () => {
      try {
        const r = await syncFeedsNowAction();
        setMsg(r.ok
          ? { kind: 'ok', text: t('msgSynced', { count: r.synced ?? 0 }) }
          : { kind: 'err', text: feedErrorMessage(t, r.error) });
      } catch {
        setMsg({ kind: 'err', text: t('errGeneric') });
      }
    });
  }
  function preview(url: string) {
    start(async () => {
      try {
        const r = await previewFeedAction(url);
        setMsg(r.ok
          ? { kind: 'ok', text: t('msgPreviewOk', { count: r.count ?? 0 }) }
          : { kind: 'err', text: feedErrorMessage(t, r.error) });
      } catch {
        setMsg({ kind: 'err', text: t('errPreview') });
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* فرم افزودن */}
      <form
        action={add}
        className="admin-card admin-rise admin-rise-1 flex flex-col gap-3 p-4 sm:flex-row sm:items-end"
        aria-label={t('addFormAria')}
      >
        <label className="flex-1 text-xs uppercase tracking-wider text-slate-400">
          {t('urlLabelFull')}
          <input
            name="url"
            type="url"
            required
            dir="ltr"
            placeholder={t('urlPlaceholder')}
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm normal-case text-slate-100 outline-none focus:border-cyan-400/60"
          />
        </label>
        <label className="text-xs uppercase tracking-wider text-slate-400 sm:w-44">
          {t('labelLabel')}
          <input
            name="label"
            type="text"
            maxLength={80}
            dir="ltr"
            placeholder={t('labelPlaceholder')}
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm normal-case text-slate-100 outline-none focus:border-cyan-400/60"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          data-testid="feed-add-btn"
          className="rounded-lg bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/30 disabled:opacity-50"
        >
          {t('addFeed')}
        </button>
      </form>

      {/* FIX — بنر بازخورد اکشن‌ها (موفق/خطا) — کامپوننت مشترک AdminStatusBanner */}
      {msg && <AdminStatusBanner msg={msg} testId="feed-status" />}

      {/* چیپ شمارش منابع */}
      <p className="text-xs text-slate-500">{t('countFeeds', { count: list.filter((f) => f.enabled).length })}</p>

      {/* جدول فیدها */}
      <div className="admin-card admin-rise admin-rise-2 overflow-hidden p-0" role="region" aria-label={t('colSource')}>
        {list.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-400">
            {t('emptyMigration')}
          </p>
        ) : (
          <ul className="divide-y divide-white/5">
            {list.map((f) => (
              <li key={f.id ?? f.url} className="flex items-center gap-3 px-4 py-3">
                <span
                  aria-hidden
                  className={f.enabled ? 'admin-live-dot shrink-0' : 'h-2.5 w-2.5 shrink-0 rounded-full bg-slate-600'}
                />
                <span className={`hidden shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide sm:inline ${f.enabled ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-300' : 'border-white/10 bg-white/5 text-slate-500'}`}>
                  {f.enabled ? t('statusLive') : t('statusOff')}
                </span>
                <div className="min-w-0 flex-1">
                  <p dir="ltr" className="truncate text-sm text-slate-100">{f.url}</p>
                  {f.label ? <p className="truncate text-xs text-slate-500">{f.label}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={() => preview(f.url)}
                  disabled={pending}
                  title={t('previewTitle')}
                  className="hidden shrink-0 items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-200 disabled:opacity-50 sm:inline-flex"
                >
                  {/* FIX — لینک مستقیم /api/rss برای هر بازدیدکننده‌ای باز بود؛
                      حالا پیش‌نمایش از اکشن گاردشده ادمین انجام می‌شود و فقط
                      تعداد آیتم نمایش داده می‌شود (بدون افشای محتوای خام). */}
                  {t('preview')} <Icon name="refresh" className="h-3 w-3" />
                </button>
                {f.id ? (
                  <button
                    type="button"
                    onClick={() => toggle(f.id as string, f.enabled)}
                    disabled={pending}
                    aria-label={`${f.enabled ? t('disable') : t('enable')} ${f.url}`}
                    className="shrink-0 rounded-md border border-white/10 px-3 py-1 text-xs text-slate-200 transition hover:border-fuchsia-400/50 hover:text-fuchsia-200 disabled:opacity-50"
                  >
                    {f.enabled ? t('disable') : t('enable')}
                  </button>
                ) : (
                  <span className="shrink-0 text-xs text-slate-600">{t('builtIn')}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* پاک‌سازی کش + همگام‌سازی فوری (پیشنهاد بهبود: ادمین منتظر scheduler نماند) */}
      <div className="admin-card admin-rise admin-rise-3 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <p className="text-xs text-slate-400">
          {t('cacheNote')}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={syncNow}
            disabled={pending}
            data-testid="feed-sync-btn"
            className="inline-flex items-center gap-2 rounded-lg border border-fuchsia-400/40 px-3 py-1.5 text-xs font-semibold text-fuchsia-200 transition hover:bg-fuchsia-500/10 disabled:opacity-50"
          >
            <Icon name="refresh" className={`h-3.5 w-3.5 ${pending ? 'animate-spin' : ''}`} />
            {pending ? t('syncing') : t('syncNow')}
          </button>
          <button
            type="button"
            onClick={purge}
            disabled={pending}
            data-testid="feed-purge-btn"
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/40 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/10 disabled:opacity-50"
          >
            {t('purgeBtn')}
          </button>
        </div>
      </div>

      {/* FIX (UI زنده): موج «در حال همگام‌سازی» — فقط هنگام pending رندر می‌شود؛
          در reduced-motion خود CSS انیمیشن را خاموش می‌کند و خط ثابت می‌ماند. */}
      {pending && <div className="admin-sync-wave" role="presentation" />}
    </div>
  );
}
