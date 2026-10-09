import type { Metadata } from 'next';
import Link from 'next/link';
import { inspectAdminAccess } from '@/services/admin/adminGuard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'ORBIT Admin — Access Help',
  robots: { index: false, follow: false },
};

// SECURITY FIX — ایمیل ادمین دیگر هاردکد/چاپ نمی‌شود: این صفحه عمداً بدون
// گارد سرو می‌شود و هر بازدیدکننده ناشناس می‌تواند آن را ببیند؛ پیش از این
// آدرس ایمیل مالک، URL پروژه Supabase و دستورات SQL آماده با ایمیل واقعی در
// HTML عمومی افشا می‌شد (oracle تأیید هویت + ابزار هدف‌گیری). حالا فقط از
// متغیر محیطی سرور (در صورت وجود) استفاده می‌شود و در خروجی mask می‌گردد؛
// اگر تنظیم نشده باشد، راهنمای کلی نمایش داده می‌شود.
const OWNER_EMAIL: string | null =
  process.env.NEXT_PUBLIC_ADMIN_CONTACT_EMAIL ?? process.env.ADMIN_CONTACT_EMAIL ?? null;

/** نمایش mask شده ایمیل (a***@b.com) — برای عیب‌یابی بدون افشای کامل هویت. */
function maskEmail(email: string | null): string {
  if (!email) return '—';
  const [local, domain] = email.split('@');
  if (!domain || !local) return '•••';
  return `${local.slice(0, 1)}***@${domain}`;
}

/**
 * FIX — «/admin همیشه 404 می‌دهد»: این صفحه بدون گارد نقش سرو می‌شود و
 * دقیقاً نشان می‌دهد کدام حلقه زنجیره دسترسی شکسته است:
 *   ۱) متغیرهای محیطی Supabase روی Vercel
 *   ۲) نشست لاگین (کوکی auth token)
 *   ۳) ستون role در جدول profiles + مقدار admin برای ایمیل شما
 * همراه با کوئری آماده برای کپی.
 */
export default async function AdminAccessHelpPage({
  searchParams,
}: {
  searchParams: Promise<{ why?: string }>;
}) {
  const { why } = await searchParams;
  const state = await inspectAdminAccess();

  const steps = [
    {
      ok: state.envOk,
      title: 'Supabase environment variables on Vercel',
      // SECURITY FIX — دیگر URL/کلید واقعی و نام پروژه در متن عمومی چاپ نمی‌شود.
      fix: 'Vercel → Project Settings → Environment Variables → add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (the sb_publishable_… key), then Redeploy.',
    },
    {
      ok: !state.envOk || state.signedIn,
      title: 'You are signed in (session cookie)',
      fix: OWNER_EMAIL
        ? `Open /login?next=/admin and sign in with ${maskEmail(OWNER_EMAIL)} (the owner account). If you were already signed in but got bounced here, your session expired — sign in again.`
        : 'Open /login?next=/admin and sign in with the owner account. If you were already signed in but got bounced here, your session expired — sign in again.',
    },
    {
      ok: !state.signedIn || state.role === 'admin',
      title: "Your profile has role='admin' in Supabase",
      fix: 'Run this once in Supabase → SQL Editor:',
    },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-cyan-200">Admin access check</h1>
        {why === 'not-admin' && (
          <p className="mt-1 text-sm text-amber-300">
            You are signed in{state.email ? ` as ${maskEmail(state.email)}` : ''} but your role is{' '}
            <code className="rounded bg-white/10 px-1">{state.role ?? '(no profile row)'}</code>, not admin.
          </p>
        )}
        {why === 'banned' && (
          <p className="mt-1 text-sm text-rose-300">This account is banned.</p>
        )}
        {/* FIX — علت جدید no-env: وقتی متغیرهای محیطی Supabase روی سرور نیست،
            گارد دیگر حلقه login نمی‌زند و مستقیم اینجا می‌آید؛ راهنمای رفع
            باید همین‌جا دیده شود. */}
        {why === 'no-env' && (
          <p className="mt-1 text-sm text-rose-300">
            Supabase environment variables are missing on this server — the panel cannot check your session at all.
          </p>
        )}
        {!why && (
          <p className="mt-1 text-sm text-slate-400">
            Diagnostics for the ORBIT admin panel — live status of every gate between you and the dashboard.
          </p>
        )}
      </header>

      <ol className="space-y-4">
        {steps.map((s, i) => (
          <li
            key={i}
            className={`rounded-xl border p-4 ${
              s.ok
                ? 'border-emerald-500/40 bg-emerald-500/5'
                : 'border-rose-500/40 bg-rose-500/5'
            }`}
          >
            <p className="flex items-center gap-2 font-semibold">
              <span aria-hidden>{s.ok ? '✅' : '❌'}</span>
              <span className={s.ok ? 'text-emerald-300' : 'text-rose-300'}>{`Step ${i + 1}: ${s.title}`}</span>
            </p>
            {!s.ok && <p className="mt-2 text-sm text-slate-300">{s.fix}</p>}
          </li>
        ))}
      </ol>

      {(!steps[2].ok || why === 'not-admin') && (
        // SECURITY FIX — ایمیل واقعی هرگز در بلوک SQL چاپ نمی‌شود؛ placeholder
        // عمومی است و کاربر خودش ایمیل خود را جایگزین می‌کند.
        <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-4 text-xs leading-relaxed text-cyan-100">
          {`alter table public.profiles add column if not exists role text not null default 'user';
update public.profiles set role='admin'
where id=(select id from auth.users where email='<YOUR-ADMIN-EMAIL>');`}
        </pre>
      )}

      {/* SECURITY FIX — این صفحه عمداً بدون گارد نقش سرو می‌شود؛ پیش از این
          ایمیل و نقش کاربرِ لاگین‌شده به‌صورت خام چاپ می‌شد که برای هر بازدید
          ناشناس (ربات/اسکنر لینک) یک oracle برای تأیید «وجود نشست + آدرس
          ایمیل ادمین» بود. حالا فقط وضعیت بولین و ایمیل mask شده نمایش
          داده می‌شود — همان مقدار اطلاعات که برای عیب‌یابی لازم است. */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
        <p className="font-semibold text-slate-200">Live server state</p>
        <ul className="mt-2 space-y-1 font-mono text-xs">
          <li>env: {state.envOk ? 'OK' : 'MISSING'}</li>
          <li>signed in: {state.signedIn ? 'yes' : 'no'}</li>
          <li>email: {maskEmail(state.email)}</li>
          <li>role: {state.role ?? '—'}</li>
        </ul>
      </div>

      <Link
        href="/admin"
        className="inline-block rounded-lg bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/30"
      >
        Retry /admin
      </Link>
    </div>
  );
}
