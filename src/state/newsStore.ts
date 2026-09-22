// ORBIT — استور خبر
import { create } from 'zustand';
import type { NewsCategoryId } from '@/core/config';
import { newsService } from '@/services/news/newsService';
import { eventBus } from '@/core/eventBus';
import { createLogger } from '@/core/logger';
import type { Article, NewsQuery } from '@/types/news';
import type { LoadStatus } from '@/types/common';

const log = createLogger('state.news');

interface NewsState {
  articles: Article[];
  status: LoadStatus;
  error: string | null;
  activeCategory: NewsCategoryId | 'all';
  search: string;
  page: number;
  pageSize: number;
  total: number;
  fromCache: boolean;
  provider: string | null;
  setCategory: (c: NewsCategoryId | 'all') => void;
  setSearch: (s: string) => void;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  markRead: (id: string) => void;
  toggleBookmark: (id: string) => void;
}

const MAX_SEARCH = 100;

export const useNewsStore = create<NewsState>((set, get) => ({
  articles: [],
  status: 'idle',
  error: null,
  activeCategory: 'all',
  search: '',
  page: 1,
  pageSize: 20,
  total: 0,
  fromCache: false,
  provider: null,

  setCategory: (c) => {
    if (get().activeCategory === c) return;
    set({ activeCategory: c, page: 1, articles: [] });
    eventBus.emit('news:category-changed', { categoryId: c });
    void get().refresh();
  },

  setSearch: (s) => {
    set({ search: s.slice(0, MAX_SEARCH), page: 1, articles: [] });
    void get().refresh();
  },

  refresh: async () => {
    const { activeCategory, search, pageSize } = get();
    set({ status: 'loading', error: null });
    const query: NewsQuery = {
      category: activeCategory,
      search: search || undefined,
      page: 1,
      pageSize,
    };
    const result = await newsService.fetch(query);
    if (!result.ok) {
      log.error('بارگذاری ناموفق.', result.error.toJSON());
      set({ status: 'error', error: result.error.message });
      return;
    }
    set({
      articles: result.value.articles,
      total: result.value.total,
      fromCache: result.value.fromCache,
      provider: result.value.provider,
      page: 1,
      status: 'success',
    });
  },

  loadMore: async () => {
    const state = get();
    if (state.status === 'loading') return;
    if (state.articles.length >= state.total) return;
    const nextPage = state.page + 1;
    set({ status: 'loading' });
    const result = await newsService.fetch({
      category: state.activeCategory,
      search: state.search || undefined,
      page: nextPage,
      pageSize: state.pageSize,
    });
    if (!result.ok) {
      set({ status: 'error', error: result.error.message });
      return;
    }
    const existing = new Set(state.articles.map((a) => a.id));
    const fresh = result.value.articles.filter((a) => !existing.has(a.id));
    set({
      articles: [...state.articles, ...fresh],
      page: nextPage,
      total: result.value.total,
      status: 'success',
    });
  },

  markRead: (id) =>
    set((s) => ({
      articles: s.articles.map((a) => (a.id === id ? { ...a, isRead: true } : a)),
    })),

  toggleBookmark: (id) =>
    set((s) => ({
      articles: s.articles.map((a) =>
        a.id === id ? { ...a, isBookmarked: !a.isBookmarked } : a,
      ),
    })),
}));