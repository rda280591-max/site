// ORBIT — news store
import { create } from 'zustand';
import type { NewsCategoryId } from '@/core/config';
import { newsService } from '@/services/news/newsService';
import { dedupeArticles } from '@/utils/dedupe';
import { eventBus } from '@/core/eventBus';
import { createLogger } from '@/core/logger';
import type { Article, NewsQuery } from '@/types/news';
import type { LoadStatus } from '@/types/common';

const log = createLogger('state.news');

interface NewsState {
  articles: Article[];
  /** one-shot server-seed helper (first effect only; never read outside React). */
  seededFromDom?: () => boolean;
  status: LoadStatus;
  error: string | null;
  activeCategory: NewsCategoryId | 'all';
  search: string;
  page: number;
  pageSize: number;
  total: number;
  fromCache: boolean;
  provider: string | null;
  /**
   * FIX — سرعت سوییچ بین دکمه‌ها: مجموعهٔ idهای خوانده‌شده/بوکمارک‌شده،
   * جدا از آرایه مقالات. قبلاً هر کلیک روی «خوانده شد» کل آرایه را map و
   * رفرنس articles را عوض می‌کرد → همه کارت‌ها + داشبورد + آنالیتیکس دوباره
   * رندر می‌شدند و UI چند صد میلی‌ثانیه قفل می‌کرد. حالا فقط مصرف‌کننده‌های
   * کوچک این Set ری‌رندر می‌شوند.
   */
  readIds: ReadonlySet<string>;
  bookmarkedIds: ReadonlySet<string>;
  setCategory: (c: NewsCategoryId | 'all') => void;
  setSearch: (s: string) => void;
  loadMore: () => Promise<void>;
  /** seq is optional to stay compatible with existing void-compatible hook signatures. */
  refresh: (seq?: number) => Promise<void>;
  markRead: (id: string) => void;
  toggleBookmark: (id: string) => void;
}

const MAX_SEARCH = 100;

// FIX — debounce timer for search (module-scope, non-reactive)
let searchDebounce: ReturnType<typeof setTimeout> | undefined;

// FIX — شمارنده‌های نوبت (sequence) برای خنثی‌سازی پاسخ‌های دیرهنگام.
// ماژول‌اسکوپ و غیرری‌اکتیو؛ فقط برای مقایسهٔ تازگی فراخوانی استفاده می‌شوند.
let refreshSeq = 0;
let loadMoreSeq = 0;

// FIX — گارد هم‌زمانی refresh: اگر دو کامپوننت (مثلاً NewsFeed و useNews)
// هم‌زمان در حالت idle باشند، قبلاً دو fetch یکسان راه می‌افتاد و Thread
// اصلی با پارس/نرمال‌سازی دوبله درگیر می‌شد. حالا دومین فراخوانی به
// promise در حال اجرا attach می‌شود (single-flight).
let inFlightRefresh: Promise<void> | null = null;

// FIX — کشِ نتیجه برای TTL کوتاه: برگشت به صفحه‌ای که تازه لود شده
// (خانه ↔ اخبار ↔ آنالیتیکس) باید آنی باشد، نه re-fetch شبکه‌ای.
// newsService کش ۵ دقیقه‌ای دارد، اما store بعد از unmount مقدار status
// را success نگه می‌دارد؛ اینجا فقط جلوی پرش‌های مکرر دسته/جستجو را می‌گیرد.

/**
 * FIX — ریشه اصلی LCP=6.9s موبایل: آیتم‌های خبر در HTML اولیه نبودند؛
 * NewsFeed بعد از hydrate با fetch /api/rss + پارس دوباره ساخته می‌شد.
 * حالا صفحه سروری Article[] نرمال‌شده را داخل <script type="application/json"
 * id="orbit-news-seed-<locale>"> می‌گذارد و این تابع پیش از اولین effect
 * همان را می‌خواند → کارت اول (تصویر LCP) در اولین paint رندر می‌شود.
 * try/catch عمدی است: نبود/خرابی تگ seed نباید هرگز رندر را بشکند؛
 * مسیر قبلی (fetch) به‌عنوان fallback دست‌نخورده باقی می‌ماند.
 */
/**
 * locale فعال را از خودِ تگ seed استخراج می‌کند (id="orbit-news-seed-<locale>")؛
 * documentElement.lang همیشه با مسیر مطابقت ندارد و قبلاً علت seed نشدن بود.
 */
function getSeedLocale(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const el = document.querySelector<HTMLScriptElement>('script[id^="orbit-news-seed-"]');
  if (!el?.id) return undefined;
  const suffix = el.id.replace(/^orbit-news-seed-/, '');
  return suffix || undefined;
}

function readServerSeed(locale?: string): Article[] | null {
  if (typeof document === 'undefined') return null;
  const el = document.getElementById(
    locale ? `orbit-news-seed-${locale}` : 'orbit-news-seed',
  ) as HTMLScriptElement | null;
  if (!el?.textContent) return null;
  try {
    const parsed: unknown = JSON.parse(el.textContent);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    // Minimal structural validation — only objects with id/title/url pass through.
    return parsed.filter(
      (a): a is Article =>
        typeof a === 'object' && a !== null &&
        typeof (a as Article).id === 'string' &&
        typeof (a as Article).title === 'string' &&
        typeof (a as Article).url === 'string',
    );
  } catch {
    return null;
  }
}

export const useNewsStore = create<NewsState>((set, get) => {
  // FIX — هنگام رسیدن پاسخ تازه، membership همان idها را از Setهای محلی
  // (که کاربر در این نشست تغییر داده) روی آبجکت‌های جدید اعمال می‌کنیم؛
  // برای اینکه کارت‌ها درست render شوند ولی articles در حالت عادی بی‌دلیل
  // map نشود.
  const applyLocalFlags = (list: Article[]): Article[] => {
    const { readIds, bookmarkedIds } = get();
    if (readIds.size === 0 && bookmarkedIds.size === 0) return list;
    return list.map((a) => {
      const isRead = a.isRead || readIds.has(a.id);
      const isBookmarked = a.isBookmarked || bookmarkedIds.has(a.id);
      if (isRead === a.isRead && isBookmarked === a.isBookmarked) return a;
      return { ...a, isRead, isBookmarked };
    });
  };

  // FIX — LCP موبایل: مقدار اولیه articles/status در زمان ساخت store از تگ
  // seed سرور خوانده می‌شود؛ اما store ممکن است زودتر از درج تگ در DOM ساخته
  // شود (import order). این helper در اولین effect صدا زده می‌شود و اگر هنوز
  // داده‌ای نیست، seed را اعمال می‌کند. refresh معمولی بعدی فقط در پس‌زمینه
  // تازه‌سازی می‌کند (چون status دیگر success است، NewsFeed کارت‌ها را نگه
  // می‌دارد و اسکرین لودینگ نمایش نمی‌دهد → بدون CLS، بدون waterfall).
  const seededFromDom = (): boolean => {
    if (get().status !== 'idle') return false;
    // locale واقعی = انتهای id تگ seed (orbit-news-seed-<locale>)؛ documentElement.lang
    // همیشه با مسیر مطابقت ندارد. fallback به lang برای سازگاری حفظ شده.
    const locale = getSeedLocale();
    const seed = readServerSeed(locale) ?? readServerSeed(undefined);
    if (!seed || seed.length === 0) return false;
    set({ articles: applyLocalFlags(seed), total: seed.length, status: 'success', provider: 'rss' });
    return true;
  };

  // یک‌بار seed در زمان ساخت store (اگر DOM آماده باشد) تا حتی قبل از اولین
  // effect، articles/total/status پر باشند (کارت اول در اولین paint).
  const initialSeed = typeof window === 'undefined' ? null : readServerSeed(getSeedLocale());

  return {
    // FIX — LCP موبایل: اگر تگ seed سرور در HTML اولیه باشد، مقالات از همان
    // ابتدا success رندر می‌شوند (کارت اول + تصویر LCP در اولین paint)؛
    // refresh بعدی فقط در پس‌زمینه داده را تازه می‌کند.
    articles: initialSeed ?? [],
    status: initialSeed && initialSeed.length > 0 ? 'success' : 'idle',
    error: null,
    activeCategory: 'all',
    search: '',
    page: 1,
    pageSize: 20,
    total: initialSeed?.length ?? 0,
    fromCache: false,
    provider: null,
    readIds: new Set<string>(),
    bookmarkedIds: new Set<string>(),
    seededFromDom,

    setCategory: (c) => {
      if (get().activeCategory === c) return;
      // FIX — سرعت سوییچ: قبلاً اینجا articles خالی و status=idle می‌شد و
      // NewsFeed برای یک لحظه به اسکرین «لودینگ» می‌پرید؛ کاربر حس تأخیر
      // داشت. حالا محتوای قبلی تا رسیدن پاسخ جدید روی صفحه می‌ماند و
      // جای آن فقط opacity کم می‌شود (بدون جابه‌جایی layout، بدون فلش).
      // FIX — شرط رقابت: شمارهٔ نوبت اضافه شد تا فقط پاسخِ تازه‌ترین
      // فراخوانی اعمال شود.
      const seq = ++refreshSeq;
      set({ activeCategory: c, page: 1, status: 'loading' });
      eventBus.emit('news:category-changed', { categoryId: c });
      void get().refresh(seq);
    },

    setSearch: (s) => {
      const search = s.slice(0, MAX_SEARCH);
      if (get().search === search) return;
      set({ search });
      // FIX — تایپ سریع قبلاً به ازای هر کاراکتر یک fetch راه می‌انداخت
      // (۱۰ کاراکتر = ۱۰ request). حالا debounce ۳۰۰ms:
      // فقط آخرین تایپ باعث refresh می‌شود و پاسخ‌های دیرهنگام با گارد
      // sequence داخل refresh دور ریخته می‌شوند.
      if (searchDebounce) clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        const seq = ++refreshSeq;
        void get().refresh(seq);
      }, 300);
    },

    refresh: async (seq?: number) => {
      // FIX — single-flight: اگر refresh دیگری همین حالا در حال اجراست و
      // پارامترها عوض نشده‌اند، همان promise را برگردان (نه fetch دوم).
      if (inFlightRefresh && seq === undefined) {
        return inFlightRefresh;
      }

      const mySeq = seq ?? ++refreshSeq;
      const { activeCategory, search, pageSize } = get();
      set({ status: 'loading', error: null });
      const query: NewsQuery = {
        category: activeCategory,
        search: search || undefined,
        page: 1,
        pageSize,
      };

      const run = (async () => {
        const result = await newsService.fetch(query);
        // Stale responses (user changed category/search meanwhile) are discarded.
        if (mySeq !== refreshSeq) return;
        if (!result.ok) {
          log.error('بارگذاری ناموفق.', result.error.toJSON());
          set({ status: 'error', error: result.error.message });
          return;
        }
        set({
          articles: applyLocalFlags(result.value.articles),
          total: result.value.total,
          fromCache: result.value.fromCache,
          provider: result.value.provider,
          page: 1,
          status: 'success',
        });
      })().finally(() => {
        if (inFlightRefresh === run) inFlightRefresh = null;
      });

      inFlightRefresh = run;
      return run;
    },

  loadMore: async () => {
    const state = get();
    if (state.status === 'loading') return;
    if (state.articles.length >= state.total) return;
    // FIX — شرط رقابت (بازدید سراسری): اگر refresh در حال اجراست، صفحه بعدی
    // نباید روی لیستِ در حال تعویض append شود؛ صبر کن تا refresh تمام شود.
    if (inFlightRefresh) {
      await inFlightRefresh.catch(() => undefined);
      void get().loadMore();
      return;
    }
    // FIX — شرط رقابت: تغییر دسته A→B→A باعث می‌شد گارد «activeCategory برابر
    // است» پاسخ قدیمی loadMore را بپذیرد و صفحهٔ دستهٔ قبلی به لیست تازه
    // append شود. حالا هر refresh با ++refreshSeq این نوبت را بی‌اعتبار
    // می‌کند، فارغ از اینکه دسته نهایی کدام باشد.
    const myRefreshSeq = refreshSeq;
    const seq = ++loadMoreSeq;
    const nextPage = state.page + 1;
    set({ status: 'loading' });
    const result = await newsService.fetch({
      category: state.activeCategory,
      search: state.search || undefined,
      page: nextPage,
      pageSize: state.pageSize,
    });
    // If category/search changed while loading, do not append this page to the new list.
    if (
      seq !== loadMoreSeq ||
      myRefreshSeq !== refreshSeq ||
      get().activeCategory !== state.activeCategory ||
      get().search !== state.search
    ) {
      return;
    }
    if (!result.ok) {
      set({ status: 'error', error: result.error.message });
      return;
    }
    const existing = new Set(state.articles.map((a) => a.id));
    const fresh = result.value.articles.filter((a) => !existing.has(a.id));
    set({
      articles: applyLocalFlags(dedupeArticles([...state.articles, ...fresh])),
      page: nextPage,
      total: result.value.total,
      status: 'success',
    });
  },

  // FIX — markRead/toggleBookmark روی Setهای جدا: رفرنس articles دست
  // نمی‌خورد؛ فقط یک id اضافه/حذف می‌شود. مصرف‌کننده‌ها (کارت تکی) با
  // selector روی membership آن id ری‌اکت می‌کنند → رندر O(1) به‌جای O(n).
  markRead: (id) =>
    set((s) => {
      if (s.readIds.has(id)) return s;
      const readIds = new Set(s.readIds);
      readIds.add(id);
      return { readIds };
    }),

      toggleBookmark: (id) =>
        set((s) => {
          const bookmarkedIds = new Set(s.bookmarkedIds);
          if (bookmarkedIds.has(id)) bookmarkedIds.delete(id);
          else bookmarkedIds.add(id);
          return { bookmarkedIds };
        }),
  };
});