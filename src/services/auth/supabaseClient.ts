import { createBrowserClient } from '@supabase/ssr';

/**
 /* Builds the browser-side Supabase client.
 *
 * اگر متغیرهای محیطی در Vercel ست نشده باشند، createBrowserClient با
 * آرگومان undefined throws می‌کرد و کل صفحه لاگین/داشبورد کرش می‌شد.
 * اینجا null برمی‌گردانیم و مصرف‌کننده باید آن را چک کند.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
