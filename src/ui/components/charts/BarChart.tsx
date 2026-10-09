import React from 'react';
import { useFormatters } from '@/ui/hooks/useFormatters';

interface DataPoint { label: string; value: number; color?: string }
interface Props { data: DataPoint[]; className?: string }

export function BarChart({ data, className = '' }: Props) {
  const fmt = useFormatters();
  if (!data.length) return null;
  /*
   * FIX UI — دو نقص:
   * a) مقدار NaN/منفی (داده خراب فید) → percent خراب و CSS نامعتبر؛ حالا
   *    فقط اعداد متناهی و غیرمنفی وارد مقیاس‌دهی می‌شوند.
   * b) key={i} با تغییر ترتیب داده باعث جابه‌جایی نادرست انیمیشن عرض شد؛
   *    حالا label+index به‌عنوان کلید پایدارتر استفاده می‌شود.
   */
  const clean = data.map((d) => ({ ...d, value: Number.isFinite(d.value) && d.value > 0 ? d.value : 0 }));
  const max = Math.max(...clean.map((d) => d.value), 1);
  return (
    <div className={['space-y-3', className].join(' ')}>
      {clean.map((d, i) => {
        const percent = (d.value / max) * 100;
        return (
          <div key={`${d.label}-${i}`}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span>{d.label}</span>
              <span className="text-orbit-text-muted">{fmt.number(d.value)}</span>
            </div>
            {/* FIX a11y — نوارها برای screen reader معنایی نبودند؛ role=img + aria-label اضافه شد */}
            <div
              className="h-2 rounded-full bg-white/5 overflow-hidden"
              role="img"
              aria-label={`${d.label}: ${d.value}`}
            >
              <div
                className="h-full rounded-full transition-[width] duration-700"
                style={{ width: `${percent}%`, background: d.color ?? 'linear-gradient(90deg, #7C3AED, #06B6D4)' }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
export default BarChart;