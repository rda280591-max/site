'use client';
import React, { useEffect, useState } from 'react';
import { Icon } from '../atoms/Icon';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  debounceMs?: number;
  autoFocus?: boolean;
  className?: string;
}

export function SearchBar({ value, onChange, placeholder = 'جستجو…', debounceMs = 300, autoFocus, className = '' }: Props) {
  const [local, setLocal] = useState(value);
  useEffect(() => {
    const sync = window.setTimeout(() => setLocal(value), 0);
    return () => window.clearTimeout(sync);
  }, [value]);
  useEffect(() => {
    if (local === value) return;
    const t = setTimeout(() => onChange(local), debounceMs);
    return () => clearTimeout(t);
  }, [local, value, debounceMs, onChange]);

  return (
    <div className={['orbit-glass flex items-center gap-2 rounded-xl px-3 py-2 transition-all','focus-within:border-violet-500/40 focus-within:shadow-[0_0_0_3px_rgba(124,58,237,0.15)]',className].join(' ')}>
      <Icon name="search" size={16} className="text-orbit-text-muted shrink-0" />
      <input
        type="text"
        value={local}
        autoFocus={autoFocus}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm text-orbit-text placeholder:text-orbit-text-muted focus:outline-none"
      />
      {local && (
        <button
          type="button"
          onClick={() => { setLocal(''); onChange(''); }}
          className="text-orbit-text-muted hover:text-orbit-text transition"
          aria-label="پاک کردن"
        >
          <Icon name="close" size={14} />
        </button>
      )}
    </div>
  );
}
export default SearchBar;