'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '../atoms/Icon';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  debounceMs?: number;
  autoFocus?: boolean;
  className?: string;
}

export function SearchBar({ value, onChange, placeholder, debounceMs = 180, autoFocus, className = '' }: Props) {
  const t = useTranslations('common');

  /*
   * FIX — سرعت تایپ/سوییچ: sync قبلاً با setTimeout(…,0) یک دور کامل
   * event-loop اضافه می‌کرد. حالا از الگوی رسمی React برای همگام‌سازی با
   * prop خارجی استفاده شده: «setState حین render» فقط وقتی مقدار بیرونی
   * واقعاً عوض شده (مثلاً دکمه پاک‌کردن) — بدون ref، بدون cascade effect.
   */
  const [local, setLocal] = useState(value);
  const [lastSynced, setLastSynced] = useState(value);
  if (value !== lastSynced) {
    setLastSynced(value);
    setLocal(value);
  }

  /*
   * FIX UI — state desync: اگر onChange از بیرون پایدار نباشد (render هر
   * parent یک تابع جدید می‌سازد)، effect زیر در هر render timer را ریست
   * می‌کرد و debounce عملاً هیچ‌وقت fire نمی‌شد. حالا callback در ref
   * نگه داشته می‌شود؛ فقط [local, value, debounceMs] دیپندنسی هستند.
   */
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (local === value) return;
    const timer = setTimeout(() => onChangeRef.current(local), debounceMs);
    return () => clearTimeout(timer);
  }, [local, value, debounceMs]);

  return (
    <div className={['orbit-glass flex items-center gap-2 rounded-xl px-3 py-2 transition-[border-color,box-shadow]','focus-within:border-violet-500/40 focus-within:shadow-[0_0_0_3px_rgba(124,58,237,0.15)]',className].join(' ')}>
      <Icon name="search" size={16} className="text-orbit-text-muted shrink-0" />
      <input
        type="text"
        value={local}
        autoFocus={autoFocus}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder ?? t('search')}
        className="w-full bg-transparent text-sm text-orbit-text placeholder:text-orbit-text-muted focus:outline-none focus-visible:outline-none"
      />
      {local && (
        <button
          type="button"
          onClick={() => { setLocal(''); onChange(''); }}
          className="text-orbit-text-muted hover:text-orbit-text transition"
          aria-label={t('clear')}
        >
          <Icon name="close" size={14} />
        </button>
      )}
    </div>
  );
}
export default SearchBar;