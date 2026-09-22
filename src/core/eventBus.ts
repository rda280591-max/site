// ORBIT — اتوبوس رویداد
import { createLogger } from './logger';

const log = createLogger('core.eventBus');

export interface OrbitEvents {
  'news:fetched': { count: number; category?: string };
  'news:error': { message: string };
  'news:category-changed': { categoryId: string };
  'notes:created': { id: string };
  'notes:updated': { id: string };
  'notes:deleted': { id: string };
  'settings:changed': { key: string; value: unknown };
  'ui:theme-changed': { theme: 'dark' | 'light' };
  'ui:sidebar-toggled': { open: boolean };
  'cache:invalidated': { key: string };
}

type Listener<K extends keyof OrbitEvents> = (payload: OrbitEvents[K]) => void;

class EventBus {
  private listeners = new Map<keyof OrbitEvents, Set<Listener<never>>>();

  on<K extends keyof OrbitEvents>(event: K, listener: Listener<K>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener as Listener<never>);
    log.debug(`شنونده ثبت شد: ${String(event)}`);
    return () => this.off(event, listener);
  }

  once<K extends keyof OrbitEvents>(event: K, listener: Listener<K>): () => void {
    const wrapper: Listener<K> = (payload) => {
      this.off(event, wrapper);
      listener(payload);
    };
    return this.on(event, wrapper);
  }

  off<K extends keyof OrbitEvents>(event: K, listener: Listener<K>): void {
    this.listeners.get(event)?.delete(listener as Listener<never>);
  }

  emit<K extends keyof OrbitEvents>(event: K, payload: OrbitEvents[K]): void {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return;
    for (const listener of set) {
      try {
        (listener as Listener<K>)(payload);
      } catch (e) {
        log.error(`خطا در شنونده‌ی رویداد «${String(event)}»`, e);
      }
    }
  }

  clear(): void {
    this.listeners.clear();
    log.debug('همه‌ی شنونده‌ها پاک شدند.');
  }
}

export const eventBus = new EventBus();
export default eventBus;