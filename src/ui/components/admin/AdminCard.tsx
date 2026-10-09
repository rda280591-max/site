import type { ReactNode } from 'react';

/**
 * کارت ادمین — دو حالت:
 *  - tone="metric": کارت متریک داشبورد، با برق عبوری ملایم (admin.css)
 *  - tone="plain": کارت محتوایی معمولی با لبه نورانی hover
 * title هم سرتیتر بصری کوچک است هم نام region؛ aside چیپ سمت چپ عنوان است.
 */
export default function AdminCard({
  title,
  aside,
  tone = 'plain',
  delay = 0,
  children,
}: {
  title?: string;
  aside?: ReactNode;
  tone?: 'plain' | 'metric';
  delay?: 0 | 1 | 2 | 3 | 4;
  children: ReactNode;
}) {
  return (
    <section
      className={`admin-card ${tone === 'metric' ? 'admin-card--metric' : ''} admin-rise${delay ? ` admin-rise-${delay}` : ''} p-4 sm:p-5`}
      aria-label={title}
    >
      {title || aside ? (
        <header className="mb-3 flex items-center justify-between gap-2">
          {title ? (
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h3>
          ) : <span />}
          {aside}
        </header>
      ) : null}
      {children}
    </section>
  );
}
