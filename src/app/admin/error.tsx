'use client';

/** Fallback خطای پنل ادمین با Retry — بدون افشای stack به کاربر. */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="orbit-glass mx-auto mt-16 max-w-md rounded-2xl p-6 text-center" role="alert">
      <h2 className="mb-2 text-lg font-semibold text-fuchsia-300">Something went wrong</h2>
      <p className="mb-4 text-sm text-slate-400">{error.digest ? `Ref: ${error.digest}` : 'Please try again.'}</p>
      <button type="button" onClick={reset} data-testid="admin-retry"
        className="rounded-lg bg-cyan-500/20 px-4 py-2 text-sm text-cyan-200 hover:bg-cyan-500/30">Retry</button>
    </div>
  );
}
