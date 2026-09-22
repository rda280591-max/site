// ORBIT — استور تنظیمات
import { create } from 'zustand';
import { lsGet, lsSet } from '@/services/storage/localStorage';
import { eventBus } from '@/core/eventBus';
import { NEWS_CATEGORIES, type NewsCategoryId } from '@/core/config';
import type { ThemeMode } from '@/types/common';

const LS_KEY = 'settings';

interface SettingsState {
  theme: ThemeMode;
  density: 'compact' | 'comfortable';
  fontScale: number;
  pinnedCategories: NewsCategoryId[];
  reduceMotion: boolean;
  showImages: boolean;
  set: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
  togglePinnedCategory: (id: NewsCategoryId) => void;
}

interface PersistedSettings {
  theme: ThemeMode;
  density: 'compact' | 'comfortable';
  fontScale: number;
  pinnedCategories: NewsCategoryId[];
  reduceMotion: boolean;
  showImages: boolean;
}

const DEFAULTS: PersistedSettings = {
  theme: 'dark',
  density: 'comfortable',
  fontScale: 1,
  pinnedCategories: NEWS_CATEGORIES.slice(0, 4).map((c) => c.id),
  reduceMotion: false,
  showImages: true,
};

function loadPersisted(): PersistedSettings {
  const raw = lsGet<Partial<PersistedSettings>>(LS_KEY, {});
  return { ...DEFAULTS, ...raw };
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...loadPersisted(),

  set: (key, value) => {
    set({ [key]: value } as unknown as Partial<SettingsState>);
    const snapshot: PersistedSettings = {
      theme: get().theme,
      density: get().density,
      fontScale: get().fontScale,
      pinnedCategories: get().pinnedCategories,
      reduceMotion: get().reduceMotion,
      showImages: get().showImages,
    };
    lsSet(LS_KEY, snapshot);
    eventBus.emit('settings:changed', { key: String(key), value });
    if (key === 'theme') {
      eventBus.emit('ui:theme-changed', {
        theme: get().theme === 'light' ? 'light' : 'dark',
      });
    }
  },

  togglePinnedCategory: (id) => {
    const current = get().pinnedCategories;
    const next = current.includes(id)
      ? current.filter((c) => c !== id)
      : [...current, id];
    get().set('pinnedCategories', next);
  },
}));