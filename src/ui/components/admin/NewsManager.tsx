'use client';

import { useTransition, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { saveArticleAction, deleteArticleAction } from '@/services/admin/adminActions';
import type { ArticleRow } from '@/services/admin/adminQueries';
import ImageUploadButton from './ImageUploadButton';
import AdminStatusBanner, { type AdminMsg } from './AdminStatusBanner';
import { formatJalali } from '@/utils/date';

const CATEGORIES = ['tech', 'science', 'world', 'business', 'sports', 'health', 'politics'];
const EMPTY: ArticleRow = { id: '', title: '', summary: '', category: 'tech', source_name: 'ORBIT', url: '', image_url: null, published_at: '', is_published: true };

/** FIX — نمایش امن تاریخ: ورودی نامعتبر/خالی دیگر «Invalid Date» خام نمی‌دهد.
 * FIX (دوزبانه‌سازی): fa → تقویم هجری شمسی با ارقام فارسی (formatJalali کش‌شده
 * از utils/date)؛ قبلاً toLocaleDateString که هم کندتر بود و هم جلالی کامل نبود. */
function safeDate(value: string | null | undefined, locale: string): string {
  if (!value) return '—';
  return formatJalali(value, locale === 'fa' ? 'fa' : 'en');
}

export default function NewsManager({ articles }: { articles: ArticleRow[] }) {
  // FIX (دوزبانه‌سازی): همه متن‌ها از admin.news در messages/admin.json
  const t = useTranslations('admin.news');
  const locale = useLocale();
  const [draft, setDraft] = useState<ArticleRow>(EMPTY);
  const [rows, setRows] = useState<ArticleRow[]>(articles);
  // FIX — همگام‌سازی با سرور بدون محو ویرایش: قبلاً هر تغییر props (که در RSC
  // تقریباً هر render شیء تازه است) کل rows را بازنویسی می‌کرد و پیش‌نویس‌های
  // ذخیره‌نشده/تازه‌ذخیره‌شده ادمین ناپدید می‌شدند. حالا فقط ردیف‌هایی که در
  // سرور عوض/حذف شده‌اند ادغام می‌شوند؛ ردیف‌های محلیِ تازه (id که در props سرور
  // نیست) حفظ می‌شوند.
  const [prevArticles, setPrevArticles] = useState(articles);
  if (prevArticles !== articles) {
    setPrevArticles(articles);
    setRows((current) => {
      // ردیف‌های محلیِ تازه (id که در props سرور نیست) حفظ می‌شوند؛ برای
      // idهای مشترک، داده تازه سرور برنده است — این دقیقاً همان حالتی است که
      // ادمین ذخیره کرده و سپس revalidate شده، پس نسخه سرور جدیدتر است.
      const serverIds = new Set(articles.map((a) => a.id));
      const localOnly = current.filter((a) => !serverIds.has(a.id));
      return [...localOnly, ...articles];
    });
  }
  // FIX (دسترسی/UX): msg حالا شیء {kind,text} است تا بنر موفقیت سبز و بنر خطا
  // قرمز متمایز شوند؛ قبلاً هر دو با یک رنگ خنثی رندر می‌شدند و ادمین نمی‌توانست
  // در یک نگاه بفهمد عملیات موفق بوده یا نه.
  const [msg, setMsg] = useState<AdminMsg | null>(null);
  const [pending, start] = useTransition();
  // FIX (UI زنده): فیلتر سریع جدول — ادمین با ده‌ها مقاله نباید اسکرول کند
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const visible = needle ? rows.filter((a) => a.title.toLowerCase().includes(needle) || (a.source_name ?? '').toLowerCase().includes(needle)) : rows;

  const set = (k: keyof ArticleRow) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setDraft({ ...draft, [k]: e.target.value });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      setMsg(null);
      const r = await saveArticleAction({ ...draft, body: draft.summary });
      if (r.ok) {
        // FIX — id واقعیِ بازگشتی از سرور؛ اگر migration قدیمی id نداد، همان
        // مسیر قبلی حفظ می‌شود (dedupe بر اساس id محلی).
        const savedId = r.id ?? draft.id;
        setRows([{ ...draft, id: savedId, published_at: new Date().toISOString() }, ...rows.filter((x) => x.id !== savedId)]);
        setDraft(EMPTY);
        setMsg({ kind: 'ok', text: t('savedOk') });
      }
      else setMsg({ kind: 'err', text: `${t('errGeneric')}${r.error ? ` (${r.error})` : ''}` });
    });
  }

  function remove(id: string) {
    start(async () => {
      setMsg(null);
      const r = await deleteArticleAction(id);
      // FIX — خطای حذف قبلاً بی‌صدا نادیده گرفته می‌شد؛ حالا پیام نمایش داده
      // می‌شود و ردیف فقط در صورت موفقیت از جدول حذف می‌گردد.
      if (r.ok) { setRows(rows.filter((x) => x.id !== id)); setMsg({ kind: 'ok', text: t('deletedOk') }); }
      else setMsg({ kind: 'err', text: `${t('errGeneric')}${r.error ? ` (${r.error})` : ''}` });
    });
  }

  function edit(a: ArticleRow) {
    setDraft(a);
    setMsg(null);
  }
  function cancelEdit() {
    setDraft(EMPTY);
    setMsg(null);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-3 min-w-0">
        {/* نوار ابزار: جستجو + شمارش + انصراف از ویرایش */}
        <div className="admin-rise admin-rise-1 flex flex-wrap items-center gap-2">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={t('searchPlaceholder')} aria-label={t('searchPlaceholder')}
            className="min-w-40 flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-cyan-400/60" />
          <span className="whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-400">{t('countArticles', { count: rows.length })}</span>
          {draft.id ? (
            <button type="button" onClick={cancelEdit} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-300 transition hover:border-fuchsia-400/40 hover:text-fuchsia-200">{t('cancelEdit')}</button>
          ) : null}
        </div>
      <section aria-label={t('title')} className="admin-card admin-scroll admin-rise admin-rise-2 overflow-x-auto p-0">
        <table className="admin-table w-full text-start text-sm">
          <thead className="text-slate-300"><tr>{[t('colTitle'), t('colSource'), t('colCategory'), t('colDate'), ''].map(h => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {visible.map(a => (
              <tr key={a.id} data-testid={`admin-article-row-${a.id}`} className="border-t border-white/5">
                <td className="max-w-[260px] truncate px-3 py-2">{a.title}</td>
                <td className="px-3 py-2 text-slate-400">{a.source_name}</td>
                <td className="px-3 py-2"><span className="rounded bg-cyan-500/15 px-2 py-0.5 text-xs text-cyan-300">{a.category}</span></td>
                {/* FIX — تاریخ نامعتبر قبلاً «Invalid Date» خام نمایش می‌داد؛ حالا placeholder امن */}
                <td className="px-3 py-2 text-slate-400">{safeDate(a.published_at, locale)}</td>
                {/* FIX (UI زنده): space-x-* در Tailwind v4 با RTL نمی‌چرخد؛ gap مطمئن‌تر است */}
                <td className="flex items-center gap-3 whitespace-nowrap px-3 py-2">
                  <button type="button" onClick={() => edit(a)} aria-label={`${t('edit')}: ${a.title}`} className="text-cyan-300 hover:underline">{t('edit')}</button>
                  {/* FIX: confirm حذف با پیام بومی‌شده */}
                  <button type="button" onClick={() => { if (window.confirm(t('confirmDelete'))) remove(a.id); }} aria-label={`${t('delete')}: ${a.title}`} className="text-fuchsia-400 hover:underline">{t('delete')}</button>
                </td>
              </tr>))}
            {!visible.length && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">{rows.length ? t('noMatch') : t('empty')}</td></tr>}
          </tbody>
        </table>
      </section>
      </div>

      <form onSubmit={submit} data-testid="admin-article-form" aria-label={draft.id ? t('editArticle') : t('newArticle')} className="admin-card admin-rise admin-rise-3 space-y-3 self-start p-4 sm:p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">{draft.id ? t('editArticle') : t('newArticle')}</h2>
        <p className="text-[11px] leading-relaxed text-slate-500">{t('formHint')}</p>
        <label className="block text-xs text-slate-400">{t('headline')}<input required minLength={3} maxLength={300} value={draft.title} onChange={set('title')} data-testid="admin-title-input" className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-cyan-400/60" /></label>
        <label className="block text-xs text-slate-400">{t('urlLabel')}<input dir="ltr" required value={draft.url} onChange={set('url')} data-testid="admin-url-input" className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none transition-colors focus:border-cyan-400/60" /></label>
        <label className="block text-xs text-slate-400">{t('category')}<select value={draft.category} onChange={set('category')} data-testid="admin-category-select" className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none transition-colors focus:border-cyan-400/60">{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
        <label className="block text-xs text-slate-400">{t('summary')}<textarea rows={3} maxLength={1000} value={draft.summary} onChange={set('summary')} data-testid="admin-summary-input" className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none transition-colors focus:border-cyan-400/60" /></label>
        <ImageUploadButton onUploaded={(u) => setDraft(d => ({ ...d, image_url: u }))} />
        <button type="submit" disabled={pending} data-testid="admin-save-btn" className="w-full rounded-lg bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/30 disabled:opacity-50">{pending ? t('saving') : t('saveArticle')}</button>
        {msg && <AdminStatusBanner msg={msg} testId="admin-news-status" />}
        {/* پیش‌نمایش کارت همان استایل فید عمومی */}
        <div aria-label={t('preview')} className="rounded-xl border border-fuchsia-500/20 bg-black/40 p-3">
          <p className="mb-1 text-[10px] uppercase tracking-widest text-fuchsia-300">{t('preview')}</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- پیش‌نمایش URL دلخواه ادمین؛ remotePatterns قابل‌تنظیم نیست */}
          {draft.image_url && <img src={draft.image_url} alt="" className="mb-2 h-24 w-full rounded object-cover" />}
          <p className="line-clamp-2 text-sm font-semibold text-slate-100">{draft.title || t('untitled')}</p>
          <p className="mt-1 line-clamp-2 text-xs text-slate-400">{draft.summary}</p>
        </div>
      </form>
    </div>
  );
}
