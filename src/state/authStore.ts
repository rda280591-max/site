import { create } from 'zustand';
// PERF (root cause): lazy import instead of static — Supabase (~275KB) is no
// longer part of the initial bundle of public pages; it loads only when auth
// is actually used (hydrate on protected pages / login).
import { lazyAuth } from '@/services/auth/lazySupabase';

let hydrationPromise: Promise<void> | null = null;

interface User {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
}

/** network/server error; the user must NOT be thrown to login in this state */


interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  /** true once hydration (reading the session from Supabase) has finished */
  mounted: boolean;
  error: 'network' | 'unknown' | null;

  hydrate: () => Promise<void>;
  logout: () => Promise<void>;
}

/**
 /* Separates "invalid session" from "network down".
 *
 * این تفکیک حیاتی است: پیش‌تر هر خطایی به‌جز session_missing به‌عنوان خطای
 * شبکه ثبت می‌شد. در نتیجه یک توکن بیات/نامعتبر (Invalid Refresh Token) کاربرِ
 * کاملاً لاگین‌شده را به صفحه‌ی «تلاش کن دوباره» می‌برد و هرگز به لاگین هدایت
 * نمی‌شد → گیر افتادن روی همان صفحه.
 */
function classifyError(error: { name?: string; code?: string; message?: string } | null | undefined): {
  kind: 'none' | 'no-session' | 'network';
} {
  if (!error) return { kind: 'none' };

  const name = error.name ?? '';
  const code = error.code ?? '';
  const message = (error.message ?? '').toLowerCase();

  if (name === 'AuthSessionMissingError' || code === 'session_missing') {
    return { kind: 'no-session' };
  }

  const networky =
    name === 'AuthRetryableFetchError' ||
    code === 'fetch_failure' ||
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('timed out');

  if (networky) return { kind: 'network' };

  // بقیه‌ی خطاها (refresh token بیات، JWT نامعتبر و…) یعنی نشست قابل استفاده
  // نیست → باید پاک شود تا کاربر به لاگین برسد، نه اینکه خطای اتصال ببیند.
  return { kind: 'no-session' };
}

function mapUser(sbUser: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): User {
  const meta = sbUser.user_metadata ?? {};
  const fullName = typeof meta.full_name === 'string' ? meta.full_name : undefined;
  const name = typeof meta.name === 'string' ? meta.name : undefined;
  const avatar = meta.avatar_url ?? meta.picture;
  return {
    id: sbUser.id,
    email: sbUser.email ?? undefined,
    name: fullName || name || sbUser.email?.split('@')[0] || 'کاربر',
    avatarUrl: typeof avatar === 'string' ? avatar : undefined,
  };
}

const UNAUTHENTICATED = {
  user: null,
  isAuthenticated: false,
  mounted: true,
  error: null,
} as const;

/**
 * منبع حقیقت، session خود Supabase (کوکی) است — نه localStorage.
 * این کار از واگرایی بین کوکی نشست و وضعیت UI جلوگیری می‌کند.
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  mounted: false,
  error: null,

  hydrate: () => {
    if (hydrationPromise) return hydrationPromise;

    hydrationPromise = (async () => {
      let timeout: ReturnType<typeof setTimeout> | undefined;

      try {
        const result = await Promise.race([
          lazyAuth.getSession(),
          new Promise<never>((_, reject) => {
            timeout = setTimeout(() => reject(new Error('Auth request timed out')), 10000);
          }),
        ]);

        if (result.error) {
          const { kind } = classifyError(result.error as { name?: string; code?: string; message?: string });
          if (kind === 'network') {
            set({ user: null, isAuthenticated: false, mounted: true, error: 'network' });
          } else {
            // نشست خراب/منقضی: کوکی‌های محلی پاک می‌شوند تا تلاش بعدی
            // دوباره همان refresh بی‌نتیجه را تکرار نکند.
            await lazyAuth.signOut();
            set(UNAUTHENTICATED);
          }
        } else if (!result.data.session) {
          set(UNAUTHENTICATED);
        } else {
          // برای hydrate کلاینت، session محلی منبع کافی است. فراخوانی جداگانه‌ی
          // getUser() یک درخواست شبکه‌ی اضافه بود و در شبکه‌ی ناپایدار، حتی با
          // وجود session معتبر، صفحه را اشتباهاً روی خطای اتصال نگه می‌داشت.
          set({
            user: mapUser(result.data.session.user),
            isAuthenticated: true,
            mounted: true,
            error: null,
          });
        }
      } catch {
        set({ user: null, isAuthenticated: false, mounted: true, error: 'network' });
      } finally {
        if (timeout) clearTimeout(timeout);
        hydrationPromise = null;
      }
    })();

    return hydrationPromise;
  },

  logout: async () => {
    await lazyAuth.signOut();
    // حتی اگر فراخوانی شبکه شکست بخورد، وضعیت محلی پاک می‌شود.
    set(UNAUTHENTICATED);
  },
}));