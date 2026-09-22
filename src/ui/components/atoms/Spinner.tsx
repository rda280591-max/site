import React from 'react';
type Size = 'sm' | 'md' | 'lg';
interface Props { size?: Size; className?: string }
const SIZE_MAP: Record<Size, number> = { sm: 14, md: 20, lg: 28 };

export function Spinner({ size = 'md', className = '' }: Props) {
  const px = SIZE_MAP[size];
  return (
    <span className={['inline-block animate-spin', className].join(' ')} style={{ width: px, height: px }} role="status">
      <svg viewBox="0 0 24 24" width={px} height={px} fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
        <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </span>
  );
}
export default Spinner;