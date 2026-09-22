import React from 'react';
interface Slice { label: string; value: number; color: string }
interface Props { data: Slice[]; size?: number; thickness?: number; className?: string }

export function DonutChart({ data, size = 160, thickness = 18, className = '' }: Props) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const slices = data.reduce<Array<Slice & { length: number; offset: number }>>(
    (result, d) => {
      const length = (d.value / total) * circumference;
      const offset = result.length ? result[result.length - 1].offset + result[result.length - 1].length : 0;
      result.push({ ...d, length, offset });
      return result;
    },
    [],
  );
  return (
    <div className={['flex items-center gap-6 flex-wrap', className].join(' ')}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={thickness} />
        {slices.map((s, i) => (
          <circle key={i} cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={s.color} strokeWidth={thickness}
            strokeDasharray={`${s.length} ${circumference}`} strokeDashoffset={-s.offset} strokeLinecap="butt" />
        ))}
      </svg>
      <div className="space-y-2 text-xs">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} />
            <span className="text-orbit-text-secondary">{d.label}</span>
            <span className="text-orbit-text-muted">({d.value})</span>
          </div>
        ))}
      </div>
    </div>
  );
}
export default DonutChart;