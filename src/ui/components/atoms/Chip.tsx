'use client';
import React from 'react';

interface Props {
  active?: boolean;
  onClick?: () => void;
  color?: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function Chip({ active, onClick, color, children, className = '', disabled }: Props) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={['inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium','transition-all duration-200 whitespace-nowrap',active ? 'border-transparent text-white shadow-md scale-[1.02]' : 'border-white/10 bg-white/5 text-orbit-text-secondary hover:bg-white/10 hover:border-white/20 hover:-translate-y-px',disabled ? 'opacity-40 cursor-not-allowed' : '',className].join(' ')}
      style={active && color ? { background: color, boxShadow: `0 0 16px ${color}55` } : undefined}
    >
      {color && <span className="h-2 w-2 rounded-full" style={{ background: active ? '#fff' : color }} />}
      {children}
    </button>
  );
}
export default Chip;