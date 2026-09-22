'use client';
import { useSyncExternalStore } from 'react';

function subscribeToMediaQuery(query: string, onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => undefined;
  const mql = window.matchMedia(query);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function getMediaQuerySnapshot(query: string, fallback: boolean): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return fallback;
  return window.matchMedia(query).matches;
}

export function useMediaQuery(query: string, defaultValue = false): boolean {
  return useSyncExternalStore(
    (onChange) => subscribeToMediaQuery(query, onChange),
    () => getMediaQuerySnapshot(query, defaultValue),
    () => defaultValue,
  );
}

export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)', false);
}

export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)', true);
}