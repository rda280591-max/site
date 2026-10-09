'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

export interface AuditItem {
  id: number | string;
  actor_id: string;
  action: string;
  target: string | null;
  meta?: Record<string, unknown> | null;
  created_at: string;
}

/**
 * FIX — ناهماهنگی نام اکشن‌ها: دیتابیس (RPCها) مقادیر «article.upsert» و
 * «user.status» را ثبت می‌کنند، ولی رنگ‌بندی قبلی دنبال «article.save» و
 * «user.ban/unban» می‌گشت و همیشه badge خاکستری پیش‌فرض می‌شد. حالا کلیدها
 * با نام‌های واقعیِ لاگ‌شده هم‌خوان‌اند (+ نام‌های قدیمی هم پوشش داده شده).
 */
const ACTION_COLORS: Record<string, string> = {
  'article.upsert': 'text-cyan-200 border-cyan-400/40 bg-cyan-500/10',
  'article.save': 'text-cyan-200 border-cyan-400/40 bg-cyan-500/10',
  'article.delete': 'text-rose-200 border-rose-400/40 bg-rose-500/10',
  'user.status': 'text-amber-200 border-amber-400/40 bg-amber-500/10',
  'user.ban': 'text-amber-200 border-amber-400/40 bg-amber-500/10',
  'user.unban': 'text-emerald-200 border-emerald-400/40 bg-emerald-500/10',
  'feed.add': 'text-fuchsia-200 border-fuchsia-400/40 bg-fuchsia-500/10',
  'feed.toggle': 'text-violet-200 border-violet-400/40 bg-violet-500/10',
  'cache.purge': 'text-sky-200 border-sky-400/40 bg-sky-500/10',
};

function badge(action: string): string {
  return ACTION_COLORS[action] ?? 'text-slate-200 border-white/15 bg-white/5';
}

/** تبدیل امن تاریخ لاگ — ورودی نامعتبر به‌جای RangeError، «—» می‌شود. */
function formatAuditTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  return new Date(t).toISOString().slice(0, 16).replace('T', ' ');
}

/**
 * لاگ ممیزی — فیلتر سریع روی نوع اکشن + متن، بدون JS سنگین.
 * داده از RPC ادمین (SECURITY DEFINER) خوانده شده و اینجا فقط نمایش می‌دهد.
 */
export default function AuditTable({ rows }: { rows: AuditItem[] }) {
  // FIX (دوزبانه‌سازی): متن‌های رابط از admin.audit در messages/admin.json
  const t = useTranslations('admin.audit');
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<string>('all');

  const kinds = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) s.add((r.action ?? '').split('.')[0] || 'other');
    return ['all', ...Array.from(s).sort()];
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (kind !== 'all' && !(r.action ?? '').startsWith(kind)) return false;
      if (!needle) return true;
      return (
        (r.action ?? '').toLowerCase().includes(needle) ||
        (r.target ?? '').toLowerCase().includes(needle) ||
        (r.actor_id ?? '').toLowerCase().includes(needle)
      );
    });
  }, [rows, q, kind]);

  if (rows.length === 0) {
    return (
      <div className="orbit-glass rounded-2xl p-6 text-center text-sm text-slate-400">
        {t('emptyFull')}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="admin-rise admin-rise-1 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('filterPlaceholder')}
          aria-label={t('filterAria')}
          className="min-w-48 flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/60"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          aria-label={t('kindAria')}
          className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/60"
        >
          {kinds.map((k) => (
            <option key={k} value={k}>{k === 'all' ? t('allActions') : k}</option>
          ))}
        </select>
      </div>

      <div className="admin-card admin-scroll admin-rise admin-rise-2 overflow-x-auto p-0" role="region" aria-label={t('regionAria')}>
        <table className="admin-table w-full min-w-[560px] text-start text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3 font-medium">{t('colTimeUtc')}</th>
              <th className="px-4 py-3 font-medium">{t('colAction')}</th>
              <th className="px-4 py-3 font-medium">{t('colTarget')}</th>
              <th className="px-4 py-3 font-medium">{t('colActor')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={String(r.id)} className="border-b border-white/5 last:border-0">
                <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-400" dir="ltr">
                  {/* FIX — کرش جدول: created_at نامعتبر (migration ناقص/دست‌کاری)
                      قبلاً RangeError در render می‌داد و کل صفحه SSR را می‌سوزاند. */}
                  {formatAuditTime(r.created_at)}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${badge(r.action)}`}>
                    {r.action}
                  </span>
                </td>
                <td className="max-w-72 truncate px-4 py-2.5 text-slate-300" dir="ltr" title={r.target ?? ''}>
                  {r.target ?? '—'}
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-500" dir="ltr" title={r.actor_id}>
                  {(r.actor_id ?? '').slice(0, 8)}
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-500">{t('noMatch')}</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">{t('showing', { filtered: filtered.length, total: rows.length })}</p>
    </div>
  );
}
