import Link from 'next/link';

/**
 * FIX — «/admin تایپ می‌کنم، 404 می‌گیرد»:
 * گارد ادمین برای کاربرِ لاگین‌شده ولی غیرادمین عمداً notFound() می‌دهد
 * (عدم افشای وجود پنل). قبلاً آن 404 هیچ راهنمایی نداشت و کاربر گیر می‌کرد.
 * این صفحه همان مسیرهای واقعی را نشان می‌دهد: ورود/خروج + دستور SQL ارتقا.
 */
export default function AdminNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B0E17] p-6 text-slate-100">
      <div className="orbit-glass w-full max-w-lg rounded-2xl p-6" role="alert">
        <h1 className="mb-2 text-2xl font-bold text-fuchsia-300">404 — Access denied</h1>
        <p className="mb-4 text-sm text-slate-300">
          This page exists only for signed-in users with the <code className="rounded bg-black/40 px-1 text-cyan-300">admin</code> role.
          If you just logged in but still see this, your profile is not an admin yet.
        </p>
        <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-slate-300">
          <li>
            Sign in at <Link href="/en/login" className="text-cyan-300 underline">/en/login</Link>{' '}
            or <Link href="/fa/%D8%B1%D9%88%D8%AF" className="text-cyan-300 underline">صفحه ورود فارسی</Link>.
          </li>
          <li>Run this once in Supabase → SQL Editor:</li>
        </ol>
        <pre dir="ltr" className="overflow-x-auto rounded-lg bg-black/50 p-3 text-xs text-emerald-300"><code>{`update public.profiles set role='admin', status='active'
where id = (select id from auth.users
             where email = 'you@example.com');`}</code></pre>
        <div className="mt-4 flex gap-3">
          <Link href="/admin" data-testid="admin-404-retry"
            className="rounded-lg bg-cyan-500/20 px-4 py-2 text-sm text-cyan-200 hover:bg-cyan-500/30">
            Retry /admin
          </Link>
          <Link href="/" className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5">
            Back to site
          </Link>
        </div>
      </div>
    </div>
  );
}
