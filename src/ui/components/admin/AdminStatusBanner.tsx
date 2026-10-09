'use client';

/**
 * بنر بازخورد اکشن‌های پنل ادمین (موفق/خطا) — نسخه مشترک.
 * FIX (یکپارچگی UI): پیش‌تر سه کامپوننت (NewsManager / FeedsManager /
 * UsersTable) هر کدام الگوی متفاوتی داشتند؛ این ماژول یک قرارداد واحد می‌دهد:
 *   - role="status" + aria-live="polite" برای Screen Reader
 *   - رنگ سبز (موفقیت) و سرخابی (خطا) — هماهنگ با پالت پنل
 */
export type AdminMsg = { kind: 'ok' | 'err'; text: string };

export default function AdminStatusBanner({ msg, testId }: { msg: AdminMsg; testId?: string }) {
  return (
    <p
      role="status"
      aria-live="polite"
      data-testid={testId}
      className={`admin-rise flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${msg.kind === 'ok'
        ? 'admin-banner-ok border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
        : 'admin-banner-err border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-200'}`}
    >
      {/* نقطه رنگی = نشانه بصری سریع موفق/خطا (aria-hidden؛ متن برای SR هست) */}
      <span aria-hidden className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${msg.kind === 'ok' ? 'bg-emerald-400' : 'bg-fuchsia-400'}`} />
      {msg.text}
    </p>
  );
}
