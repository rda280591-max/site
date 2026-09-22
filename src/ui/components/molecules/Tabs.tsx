'use client';
import React from 'react';

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}

interface Props<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}

export function Tabs<T extends string>({ items, value, onChange, className = '' }: Props<T>) {
  return (
    <div className={['flex items-center gap-1 border-b border-white/5 overflow-x-auto', className].join(' ')}>
      {items.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={['relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium','transition-colors duration-200 whitespace-nowrap',active ? 'text-orbit-text' : 'text-orbit-text-secondary hover:text-orbit-text'].join(' ')}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {typeof tab.count === 'number' && (
              <span className="rounded-full bg-white/5 px-1.5 text-2xs text-orbit-text-muted">{tab.count}</span>
            )}
            {active && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full" style={{ background: 'linear-gradient(90deg, #7C3AED, #06B6D4)' }} />
            )}
          </button>
        );
      })}
    </div>
  );
}
export default Tabs;