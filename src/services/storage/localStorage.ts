// ORBIT — ذخیره‌سازی در localStorage
import { CACHE } from '@/core/config';
import { StorageError } from '@/core/errors';
import { Result, Ok, Err, tryCatchSync } from '@/core/result';
import { createLogger } from '@/core/logger';

const log = createLogger('services.storage.ls');
const PREFIX = CACHE.storagePrefix;

function isAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const probe = '__orbit_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

const available = isAvailable();
const k = (key: string) => `${PREFIX}${key}`;

export function lsGet<T>(key: string, fallback: T): T {
  if (!available) return fallback;
  const result = tryCatchSync<T>(() => {
    const raw = window.localStorage.getItem(k(key));
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  });
  if (!result.ok) {
    log.warn('خواندن از localStorage ناموفق.', { key });
    return fallback;
  }
  return result.value;
}

export function lsSet<T>(key: string, value: T): Result<void> {
  if (!available) return Err(new StorageError('localStorage در دسترس نیست.', { key }));
  const result = tryCatchSync(() => {
    window.localStorage.setItem(k(key), JSON.stringify(value));
  });
  return result.ok
    ? Ok(undefined)
    : Err(new StorageError('نوشتن در localStorage ناموفق بود.', { key }, result.error));
}

export function lsRemove(key: string): void {
  if (!available) return;
  try {
    window.localStorage.removeItem(k(key));
  } catch (e) {
    log.warn('حذف از localStorage ناموفق.', { key, error: e });
  }
}

export function lsClear(): void {
  if (!available) return;
  for (const key of lsKeys()) lsRemove(key);
}

export function lsKeys(): string[] {
  if (!available) return [];
  const out: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const full = window.localStorage.key(i);
    if (full?.startsWith(PREFIX)) out.push(full.slice(PREFIX.length));
  }
  return out;
}

export const localStorageService = {
  get: lsGet,
  set: lsSet,
  remove: lsRemove,
  clear: lsClear,
  keys: lsKeys,
  available,
};