// ORBIT — تحلیل داخلی
import { createLogger } from '@/core/logger';
import { eventBus } from '@/core/eventBus';
import { lsGet, lsSet } from '@/services/storage/localStorage';
import { NEWS_CATEGORIES } from '@/core/config';
import type { CategoryStat, Article } from '@/types/news';

const log = createLogger('services.analytics');
const STORAGE_KEY = 'analytics:events';

interface AnalyticsEvent {
  type: string;
  at: number;
  meta?: Record<string, unknown>;
}

function loadEvents(): AnalyticsEvent[] {
  return lsGet<AnalyticsEvent[]>(STORAGE_KEY, []);
}

function saveEvents(events: AnalyticsEvent[]): void {
  lsSet(STORAGE_KEY, events.slice(-500));
}

export function track(type: string, meta?: Record<string, unknown>): void {
  const events = loadEvents();
  events.push({ type, at: Date.now(), meta });
  saveEvents(events);
  log.debug('رویداد ثبت شد.', { type });
}

export function attachAnalyticsListeners(): () => void {
  const offs = [
    eventBus.on('news:fetched', (p) => track('news.fetched', p)),
    eventBus.on('news:category-changed', (p) => track('news.category', p)),
    eventBus.on('notes:created', (p) => track('notes.created', p)),
    eventBus.on('settings:changed', (p) => track('settings.changed', p)),
  ];
  return () => offs.forEach((off) => off());
}

export function computeCategoryStats(articles: Article[]): CategoryStat[] {
  const counts = new Map<string, { count: number; lastUpdated: number }>();
  for (const cat of NEWS_CATEGORIES) {
    counts.set(cat.id, { count: 0, lastUpdated: 0 });
  }
  for (const a of articles) {
    const entry = counts.get(a.category) ?? { count: 0, lastUpdated: 0 };
    entry.count += 1;
    entry.lastUpdated = Math.max(entry.lastUpdated, a.publishedAt);
    counts.set(a.category, entry);
  }
  return Array.from(counts.entries()).map(([category, v]) => ({
    category: category as CategoryStat['category'],
    count: v.count,
    lastUpdated: v.lastUpdated,
  }));
}

export function countEvents(type: string): number {
  return loadEvents().filter((e) => e.type === type).length;
}

export const analyticsService = {
  track,
  attachListeners: attachAnalyticsListeners,
  computeCategoryStats,
  countEvents,
};