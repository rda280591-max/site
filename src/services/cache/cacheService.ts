// ORBIT — کش با TTL
import { CACHE } from '@/core/config';
import { createLogger } from '@/core/logger';
import { eventBus } from '@/core/eventBus';

const log = createLogger('services.cache');

interface Entry<T> { value: T; expiresAt: number; createdAt: number }

class CacheService {
  private store = new Map<string, Entry<unknown>>();
  private maxEntries = 200;

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number = CACHE.newsTtlMs): void {
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest) this.store.delete(oldest);
    }
    this.store.set(key, { value, createdAt: Date.now(), expiresAt: Date.now() + ttlMs });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  invalidate(key: string): void {
    this.store.delete(key);
    eventBus.emit('cache:invalidated', { key });
  }

  invalidatePrefix(prefix: string): void {
    for (const key of Array.from(this.store.keys())) {
      if (key.startsWith(prefix)) this.invalidate(key);
    }
  }

  clear(): void {
    this.store.clear();
    log.debug('کش پاک شد.');
  }

  keys(prefix = ''): string[] {
    return Array.from(this.store.keys()).filter((k) => k.startsWith(prefix));
  }

  prune(): void {
    const now = Date.now();
    for (const [k, v] of this.store) {
      if (now > v.expiresAt) this.store.delete(k);
    }
  }
}

export const cacheService = new CacheService();