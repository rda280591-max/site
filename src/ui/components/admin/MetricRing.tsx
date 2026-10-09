/** متریک SVG حلقوی — صفر کتابخانه؛ انیمیشن پرشدن قوس از صفر (admin.css).
 * FIX (UI زنده): عدد وسط حلقه حالا با شمارنده CSS-only (@property) از صفر
 * تا مقدار واقعی «می‌شمارد» — حس داشبورد زنده بدون هیچ JS کلاینت.
 * aria: خود <text> برای AT خوانا نیست، بنابراین aria-label روی svg مقدار
 * نهایی را دارد و شمارنده صرفاً تزئینی است. */
export default function MetricRing({ label, value, pct, color }: { label: string; value: number; pct: number; color: string }) {
  const r = 26, c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, pct));
  return (
    <div className="relative flex items-center gap-3">
      <svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={`${label}: ${value}`}>
        {/* هاله پشت قوس — همان کاری که یک طراح با blur دستی انجام می‌دهد */}
        <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${c * clamped} ${c}`} transform="rotate(-90 32 32)" opacity="0.18" />
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
        <circle className="admin-ring-arc" style={{ ['--ring-c' as string]: `${c}` }}
          cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${c * clamped} ${c}`} transform="rotate(-90 32 32)" />
        {/* متن وسط: مقدار نهایی سمت سرور — fallback برای مرورگر بدون @property و چاپ */}
        <text x="32" y="37" textAnchor="middle" fontSize="14" fill="#e2e8f0" fontWeight="700">{value}</text>
      </svg>
      {/* لایه count-up تزئینی دقیقاً روی عدد سرور (aria-hidden؛ AT همان
          aria-label را می‌خواند). در مرورگر قدیمی بی‌متن/بی‌اثر می‌ماند و
          عدد سرور از پشتش دیده می‌شود — degradation امن. */}
      <span aria-hidden data-orbit-count={Math.round(value)}
        className="admin-count pointer-events-none absolute left-[26px] top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0d1424]/85 px-1 text-sm font-bold text-slate-100"
        style={{ ['--orbit-to' as string]: `${Math.round(value)}` }} />
      <p className="text-sm text-slate-300">{label}</p>
    </div>
  );
}
