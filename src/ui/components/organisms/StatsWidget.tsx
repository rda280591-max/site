import React from 'react';
import { Card } from '../molecules/Card';
import { Icon, type IconName } from '../atoms/Icon';
import { formatNumber } from '@/utils/formatters';

interface Props { label: string; value: number; delta?: number; icon?: IconName; accent?: string }

export function StatsWidget({ label, value, delta, icon = 'chart', accent = '#7C3AED' }: Props) {
  const isUp = (delta ?? 0) >= 0;
  return (
    <Card padding="md" glow interactive className="group">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-orbit-text-secondary mb-2">{label}</div>
          <div className="text-2xl font-black tracking-tight">{formatNumber(value)}</div>
          {typeof delta === 'number' && (
            <div className={['mt-2 inline-flex items-center gap-1 text-2xs font-medium rounded-full px-2 py-0.5',isUp ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'].join(' ')}>
              <span>{isUp ? '▲' : '▼'}</span>
       <span>{formatNumber(Math.abs(delta))}٪</span>
            </div>
          )}
        </div>
        <div
          className="h-11 w-11 grid place-items-center rounded-xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
          style={{ background: `${accent}22`, color: accent, boxShadow: `0 0 16px ${accent}33` }}
        >
          <Icon name={icon} size={20} />
        </div>
      </div>
    </Card>
  );
}
export default StatsWidget;