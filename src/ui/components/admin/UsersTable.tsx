'use client';

import { useTransition, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { banUserAction } from '@/services/admin/adminActions';
import type { ProfileRow } from '@/services/admin/adminQueries';
import AdminStatusBanner, { type AdminMsg } from './AdminStatusBanner';
import { formatJalali, formatTime, toDate } from '@/utils/date';

/** FIX (دوزبانه‌سازی + PERF): «تاریخ و ساعت» با Intl کش‌شده از utils/date.
 * ورودی نامعتبر → '—'. برای fa تقویم شمسی + ساعت تهران؛ برای en میلادی/محلی. */
function formatDateTime(value: string, locale: string): string {
  if (!toDate(value)) return '—';
  const L = locale === 'fa' ? 'fa' : 'en';
  return `${formatJalali(value, L)} — ${formatTime(value, L)}`;
}

export default function UsersTable({ users, selfId }: { users: ProfileRow[]; selfId: string }) {
  const t = useTranslations('admin.users');
  // FIX (دوزبانه‌سازی): تاریخ/اعداد با locale خود پنل فرمت می‌شوند (fa → جلالی/فارسی)
  const locale = useLocale();
  const [rows, setRows] = useState(users);
  const [pending, start] = useTransition();
  // FIX — خطای بن‌کردن بی‌صدا نادیده گرفته می‌شد (RPC fail → UI سکوت). حالا
  // پیام واقعی زیر جدول نمایش داده می‌شود تا ادمین بداند عملیات انجام نشده.
  // FIX (یکپارچگی UI): الگوی مشترک {kind,text} + بنر سبز/قرمز مثل News/Feeds؛
  // قبلاً فقط خطا و همیشه قرمز بود و موفقیت بی‌صدا می‌ماند.
  const [msg, setMsg] = useState<AdminMsg | null>(null);
  // FIX (UI زنده): فیلتر سریع — همه/ادمین‌ها/بن‌شده، با چیپ شمارش
  const [kind, setKind] = useState<'all' | 'admin' | 'banned'>('all');
  const visible = kind === 'all' ? rows : rows.filter((u) => (kind === 'admin' ? u.role === 'admin' : u.status === 'banned'));

  function toggle(u: ProfileRow) {
    start(async () => {
      setMsg(null);
      const banned = u.status !== 'banned';
      const r = await banUserAction(u.id, banned);
      if (r.ok) {
        setRows(rows.map((x) => (x.id === u.id ? { ...x, status: banned ? 'banned' : 'active' } : x)));
        setMsg({ kind: 'ok', text: banned ? t('msgBanned') : t('msgUnbanned') });
      }
      else setMsg({ kind: 'err', text: `${t('errGeneric')}${r.error ? ` (${r.error})` : ''}` });
    });
  }

  const KINDS = [
    { id: 'all', label: t('filterAll') },
    { id: 'admin', label: t('filterAdmins') },
    { id: 'banned', label: t('filterBanned') },
  ] as const;

  return (
    <div className="space-y-3">
      <div className="admin-rise admin-rise-1 flex flex-wrap items-center gap-2">
        {KINDS.map((k) => (
          <button key={k.id} type="button" onClick={() => setKind(k.id)} aria-pressed={kind === k.id}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${kind === k.id ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-200' : 'border-white/10 text-slate-400 hover:border-white/25 hover:text-slate-200'}`}>
            {k.label}
          </button>
        ))}
        <span className="ms-auto whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-400">{t('countUsers', { count: rows.length })}</span>
      </div>

      <section aria-label={t('title')} className="admin-card admin-scroll admin-rise admin-rise-2 overflow-x-auto p-0">
      <table className="admin-table w-full text-start text-sm">
        <thead className="text-slate-300"><tr>{[t('colEmail'), t('colRole'), t('colLastLogin'), t('colStatus'), ''].map(h => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
        <tbody>
          {visible.map(u => (
            <tr key={u.id} data-testid={`admin-user-row-${u.id}`} className="border-t border-white/5">
              {/* FIX: ایمیل همیشه LTR — در چیدمان RTL رشته‌های a@b.com به‌هم‌ریخته نمایش داده می‌شد */}
              <td dir="ltr" className="px-3 py-2 text-start">
                <span className="flex items-center gap-2.5">
                  <span aria-hidden className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${u.status === 'banned' ? 'bg-red-500/15 text-red-300' : 'bg-cyan-500/15 text-cyan-200'}`}>
                    {(u.email ?? u.id).slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 truncate">{u.email ?? '—'}{u.id === selfId && <span className="ms-1 text-xs text-slate-500">{t('you')}</span>}</span>
                </span>
              </td>
              <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs ${u.role === 'admin' ? 'bg-fuchsia-500/15 text-fuchsia-300' : 'bg-white/10 text-slate-300'}`}>{u.role}</span></td>
              {/* FIX (دوزبانه‌سازی): تاریخ/زمان آخرین ورود با Intl کش‌شده و بر اساس locale پنل */}
              <td className="px-3 py-2 text-slate-400" dir="ltr">{u.last_login ? formatDateTime(u.last_login, locale) : '—'}</td>
              <td className="px-3 py-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${u.status === 'banned' ? 'border-red-400/30 bg-red-500/10 text-red-300' : 'border-emerald-400/25 bg-emerald-500/10 text-emerald-300'}`}>
                  <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${u.status === 'banned' ? 'bg-red-400' : 'bg-emerald-400'}`} />
                  {u.status === 'banned' ? t('bannedTag') : t('activeTag')}
                </span>
              </td>
              <td className="px-3 py-2">
                {u.id !== selfId && (
                  <button type="button" disabled={pending} onClick={() => toggle(u)} data-testid={`admin-ban-${u.id}`}
                    aria-label={`${u.status === 'banned' ? t('unban') : t('ban')} ${u.email ?? u.id}`}
                    className="rounded px-2 py-1 text-xs hover:bg-white/10 disabled:opacity-50">
                    {u.status === 'banned' ? t('unban') : t('ban')}
                  </button>
                )}
              </td>
            </tr>))}
          {!visible.length && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">{rows.length ? t('noMatch') : '—'}</td></tr>}
        </tbody>
      </table>
      {msg && <div className="border-t border-white/5 px-3 py-2"><AdminStatusBanner msg={msg} testId="admin-users-status" /></div>}
      </section>
    </div>
  );
}
