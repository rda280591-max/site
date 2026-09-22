import React from 'react';

export type BadgeTone = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'neutral';

interface Props {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

const TONE_STYLES: Record<BadgeTone, React.CSSProperties> = {
  primary: {
    background: 'rgba(139, 92, 246, 0.18)',
    color: '#C4B5FD',
    borderColor: 'rgba(139, 92, 246, 0.35)',
  },
  secondary: {
    background: 'rgba(6, 182, 212, 0.18)',
    color: '#67E8F9',
    borderColor: 'rgba(6, 182, 212, 0.35)',
  },
  success: {
    background: 'rgba(16, 185, 129, 0.18)',
    color: '#6EE7B7',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  warning: {
    background: 'rgba(245, 158, 11, 0.18)',
    color: '#FCD34D',
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  danger: {
    background: 'rgba(239, 68, 68, 0.18)',
    color: '#FCA5A5',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  neutral: {
    background: 'rgba(255, 255, 255, 0.06)',
    color: '#A6B0C3',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
};

export function Badge({ tone = 'neutral', children, className = '', dot }: Props) {
  const style = TONE_STYLES[tone];
  return (
    <span
      className={['inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-2xs font-medium transition-transform duration-200', className].join(' ')}
      style={style}
    >
      {dot && (
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'currentColor' }} />
      )}
      {children}
    </span>
  );
}

export default Badge;