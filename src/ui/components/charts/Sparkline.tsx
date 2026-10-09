import React, { useId } from 'react';
interface Props { data: number[]; width?: number; height?: number; color?: string; fill?: boolean; className?: string }

export function Sparkline({ data, width = 120, height = 32, color = '#7C3AED', fill = true, className = '' }: Props) {
  // useId prevents gradient-id collisions when several sparklines share a page.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  if (!data.length) return null;
  /*
   * FIX UI — کرش با داده نامعتبر: قبلاً یک NaN در آرایه (مثلاً publishedAt
   * خراب از فید) باعث می‌شد کل path با «NaN» ساخته شود و SVG خطا بدهد.
   * حالا فقط اعداد متناهی وارد محاسبه می‌شوند؛ آرایه بی‌اعتبار → null.
   */
  const clean = data.filter((v) => Number.isFinite(v));
  if (!clean.length) return null;
  const max = Math.max(...clean);
  const min = Math.min(...clean);
  const range = max - min || 1;
  const stepX = width / (Math.max(clean.length, 2) - 1);
  const points = clean.map((v, i) => {
    const x = clean.length === 1 ? 0 : i * stepX;
    const y = height - ((v - min) / range) * height;
    return [x, y] as const;
  });
  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  // With one point the line path is empty; draw a flat segment instead.
  const linePath = clean.length === 1 ? `M0,${points[0][1].toFixed(1)} L${width},${points[0][1].toFixed(1)}` : line;
  const area = `${linePath} L${width},${height} L0,${height} Z`;
  const gradId = `spark-${uid}`;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      preserveAspectRatio="none"
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${gradId})`} />}
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export default Sparkline;