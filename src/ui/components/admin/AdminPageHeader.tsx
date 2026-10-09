/**
 * کامپوننت مشترک هدر صفحات پنل — الگوی طراح‌های واقعی: Eyebrow کوچک
 * گرادیانی + عنوان بزرگ + توضیح + چیپ شمارش. همه صفحه‌ها از همین
 * ریتم استفاده می‌کنند تا پنل «دست‌چین‌شده» به نظر برسد نه ۵ صفحه جدا.
 */
export default function AdminPageHeader({ eyebrow, title, subtitle, chip }: {
  eyebrow?: string; title: string; subtitle?: string; chip?: string;
}) {
  return (
    <header className="admin-rise space-y-1.5">
      <div className="flex flex-wrap items-center gap-3">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300/70">{eyebrow}</p>
        ) : null}
        {chip ? (
          <span className="rounded-full border border-cyan-400/25 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-medium text-cyan-200">
            {chip}
          </span>
        ) : null}
      </div>
      <h1 className="text-2xl font-bold text-cyan-100 sm:text-3xl">{title}</h1>
      {/* خط گرادیانی زیر عنوان — ریتم بصری مشترک همه صفحات پنل */}
      <span aria-hidden className="block h-px w-24 bg-gradient-to-r from-cyan-400/70 via-fuchsia-400/50 to-transparent" />
      {subtitle ? <p className="max-w-xl text-sm leading-relaxed text-slate-400">{subtitle}</p> : null}
    </header>
  );
}
