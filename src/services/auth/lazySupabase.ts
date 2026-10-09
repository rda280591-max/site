'use client';

import type { createClient } from './supabaseClient';

/**
 * Root-cause performance fix:
 * `@supabase/ssr` + `@supabase/supabase-js` (~275 KB) were statically imported by
 * authStore → Header/DashboardLayout → EVERY page bundle, including the public
 * home/news pages. That inflated main JS, delayed hydration and tanked TBT/LCP.
 *
 * This module keeps the same API shape but loads Supabase lazily via dynamic
 * import — only when a user actually touches an auth feature (login button,
 * hydrate on protected pages). Public pages never download or parse it.
 */

/** نوع کلاینت واقعی، بدون کشیدن کتابخانه به داخل باندل (type-only import). */
type LazySupabaseClient = Awaited<ReturnType<typeof createClient>>;

type SessionResult = Awaited<
  ReturnType<NonNullable<LazySupabaseClient>['auth']['getSession']>
>;

interface LazyAuth {
  getSession(): Promise<SessionResult | { error: Error }>;
  signOut(): Promise<void>;
}

let clientPromise: Promise<LazySupabaseClient | null> | null = null;

async function loadClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !anon) return null;
      // code-split: supabase lands in its own chunk, fetched on demand only
      const { createClient } = await import('./supabaseClient');
      return createClient();
    })();
  }
  return clientPromise;
}

export const lazyAuth: LazyAuth = {
  async getSession() {
    const client = await loadClient();
    if (!client) {
      return { data: { session: null }, error: null } as unknown as SessionResult;
    }
    try {
      return await client.auth.getSession();
    } catch (e) {
      return { data: { session: null }, error: e as Error };
    }
  },
  async signOut() {
    const client = await loadClient();
    if (!client) return;
    try {
      await client.auth.signOut();
    } catch {
      /* network failure is fine — local state is cleared regardless */
    }
  },
};

/** Used only by the login page right before OAuth redirect. */
export async function getSupabaseClient(): Promise<LazySupabaseClient | null> {
  return loadClient();
}
