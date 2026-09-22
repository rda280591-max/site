'use client';
import React, { useRef, useState } from 'react';

interface Props {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: 'top' | 'bottom' | 'right' | 'left';
  delayMs?: number;
}

export function Tooltip({ content, children, side = 'top', delayMs = 200 }: Props) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => { timer.current = setTimeout(() => setOpen(true), delayMs); };
  const hide = () => { if (timer.current) clearTimeout(timer.current); setOpen(false); };

  const positionClasses: Record<NonNullable<Props['side']>, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    right: 'right-full top-1/2 -translate-y-1/2 mr-2',
    left: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <span className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {open && (
        <span
          role="tooltip"
          className={['absolute z-50 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs','bg-black/90 text-orbit-text border border-white/10 shadow-lg','animate-[orbit-fade_150ms_ease-out]',positionClasses[side]].join(' ')}
        >
          {content}
        </span>
      )}
    </span>
  );
}
export default Tooltip;