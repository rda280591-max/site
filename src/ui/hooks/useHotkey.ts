'use client';
import { useEffect } from 'react';

export interface HotkeyOptions {
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  preventDefault?: boolean;
}

export function useHotkey(key: string, options: HotkeyOptions, handler: (e: KeyboardEvent) => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== key.toLowerCase()) return;
      if (!!options.ctrl !== (e.ctrlKey || e.metaKey)) return;
      if (options.meta !== undefined && !!options.meta !== e.metaKey) return;
      if (options.shift !== undefined && !!options.shift !== e.shiftKey) return;
      if (options.alt !== undefined && !!options.alt !== e.altKey) return;
      if (options.preventDefault) e.preventDefault();
      handler(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [key, options, handler]);
}