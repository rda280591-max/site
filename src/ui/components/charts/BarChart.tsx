import React from 'react';
import { formatNumber } from '@/utils/formatters';

interface DataPoint { label: string; value: number; color?: string }
interface Props { data: DataPoint[]; className?: string }

export function BarChart({ data, className = '' }: Props) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className={['space-y-3', className].join(' ')}>
      {data.map((d, i) => {
        const percent = (d.value / max) * 100;
        return (
          <div key={i}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span>{d.label}</span>
              <span className="text-orbit-text-muted">{formatNumber(d.value)}</span>
            </div>
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
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