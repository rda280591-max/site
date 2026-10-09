// ORBIT — settings store
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

/** Resolves the "system" theme to an applicable one (dark/light). */
function resolveTheme(mode: ThemeMode): 'dark' | 'light' {
  if (mode === 'system') {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    return 'dark';
  }
  return mode;
}

/** کلید خامی که اسکریپت ضدفلش می‌خواند و applyTheme می‌نویسد. */
const THEME_RAW_KEY = 'orbit:theme';
/** کلید معیوب نسخه‌های پیشین (applyTheme قدیمی اینجا می‌نوشت ولی anti-flash
 *  جای دیگری را می‌خواند) — برای مهاجرت یک‌باره خوانده و حذف می‌شود. */
const LEGACY_THEME_RAW_KEY = 'orbit-theme';

/** تم ذخیره‌شده کاربر؛ با اولویت استور → کلید جدید → کلید قدیمی. */
function readStoredTheme(): ThemeMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(THEME_RAW_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
    const legacy = window.localStorage.getItem(LEGACY_THEME_RAW_KEY);
    if (legacy === 'light' || legacy === 'dark') return legacy;
  } catch {
    // irrelevant
  }
  return null;
}

/**
 * تم قابل‌اعمال را روی <html> و کلید خام «orbit:theme» می‌نویسد تا با
 * اسکریپت ضدفلش در layout و هوک useTheme یکدست بماند (منبع حقیقت واحد).
 * NOTE (fix): قبلاً اینجا «orbit-theme» نوشته می‌شد ولی اسکریپت ضدفلش
 * «orbit:theme» را می‌خواند — به‌خاطر همین تم انتخابی پس از رفرش/بازگشت
 * به صفحه گم می‌شد و همیشه حالت dark برمی‌گشت.
 */
export function applyTheme(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const resolved = resolveTheme(mode);
  document.documentElement.setAttribute('data-theme', resolved);
  try {
    window.localStorage.setItem(THEME_RAW_KEY, resolved);
    // مهاجرت داده کاربران قدیمی: کلید معیوب را بعد از خواندن پاک کن تا
    // منبع حقیقت یکی بماند.
    window.localStorage.removeItem(LEGACY_THEME_RAW_KEY);
  } catch {
    // irrelevant
  }
}

function loadPersisted(): PersistedSettings {
  const raw = lsGet<Partial<PersistedSettings>>(LS_KEY, {});
  const merged = { ...DEFAULTS, ...raw };
  // FIX — حفظ تم کاربر: اگر استور هنوز مقدار پیش‌فرض دارد ولی کاربر تمش را
  // زیر کلید خام (جدید یا قدیمی) ذخیره کرده، همان را بازیابی کن.
  if (merged.theme === DEFAULTS.theme) {
    const stored = readStoredTheme();
    if (stored) merged.theme = stored;
  }
  return merged;
}

// On the client, apply the saved theme after load to stay in sync with the anti-flash script.
if (typeof window !== 'undefined') {
  applyTheme(loadPersisted().theme);
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
      // The only place applying the theme; keeps both <html> and the raw orbit-theme key in sync.
      applyTheme(get().theme);
      eventBus.emit('ui:theme-changed', { theme: resolveTheme(get().theme) });
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

/*
 * FIX — ناهمانی/فلاش تم در حالت 'system':
 * اسکریپت ضدفلش هنگام لود، media query سیستم را می‌خواند و همان را اعمال
 * می‌کند؛ اما استور بعد از hydrate مقدار پیش‌فرض 'dark' را روی <html> می‌نوشت
 * و کاربر روشن‌تمِ سیستم یک فلاش dark تجربه می‌کرد. این listener تغییرات
 * سیستم‌عامل را زنده دنبال می‌کند تا هر دو منبع همیشه هم‌راستا بمانند.
 */
if (typeof window !== 'undefined' && window.matchMedia) {
  const mq = window.matchMedia('(prefers-color-scheme: light)');
  const syncSystemTheme = () => {
    if (useSettingsStore.getState().theme === 'system') applyTheme('system');
  };
  // addEventListener جدیدتر از addListener است؛ برای Safari قدیمی fallback.
  if (typeof mq.addEventListener === 'function') mq.addEventListener('change', syncSystemTheme);
  else {
    const legacy = mq as unknown as {
      addListener?: (cb: () => void) => void;
      removeListener?: (cb: () => void) => void;
    };
    if (typeof legacy.addListener === 'function') legacy.addListener(syncSystemTheme);
  }
}