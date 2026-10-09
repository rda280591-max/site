'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { authErrorFromStatus, type AuthErrorCode } from '@/core/authErrors';

/**
 * فرم ورود ایمیل/رمز — مکمل Google OAuth.
 *
 * چرا: endpoint /api/admin/login احراز هویت را سمت سرور انجام می‌دهد و کوکی
 * نشست را روی پاسخ ست می‌کند؛ اینجا فقط فرم + پیام خطای بومی‌شده است.
 * UX PRO:
 *  - toggle نمایش رمز، disabled/hint در حالت pending، Enter = submit
 *  - بعد از موفقیت router.refresh() تا گارد سرور (/admin) نشست تازه را ببیند
 */
export default function PasswordLoginForm({ next }: { next: string | null }) {
  const t = useTranslations('login.form');
  const tErr = useTranslations('login.errors');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pending, setPending] = useState(false);
  const [errorKey, setErrorKey] = useState<AuthErrorCode | null>(null);

  // مقصد پس از ورود: فقط مسیر نسبی داخلی (هم‌راستا با safeNext در callback)
  const dest = next && next.startsWith('/') && !next.startsWith('//') ? next : '/admin';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setErrorKey(null);
    setPending(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        // کوکی نشست روی پاسخ ست شده؛ refresh تا layout ادمین دوباره requireAdmin کند
        router.replace(dest);
        router.refresh();
        return;
      }
      let code: AuthErrorCode = authErrorFromStatus(res.status);
      try {
        const j = (await res.json()) as { error?: string };
        if (j?.error === 'rate_limited') code = 'rate_limited';
        else if (j?.error === 'service_unavailable') code = 'service_unavailable';
        else if (j?.error === 'invalid_body') code = 'invalid_body';
      } catch {
        /* پاسخ غیر-JSON → همان کد مبتنی بر status */
      }
      setErrorKey(code);
      setPending(false);
    } catch {
      setErrorKey('signin_failed');
      setPending(false);
    }
  }

  // fallback ایمن: اگر روزی کلید ترجمه یک کد جدید جا بیفتد، «generic» نشان داده
  // می‌شود نه رشته خام next-intl (جلوگیری از پیام انگلیسی/تکنیکال به کاربر).
  const errText = errorKey
    ? tErr.has(errorKey) ? tErr(errorKey) : tErr('generic')
    : null;

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      {errText && (
        <p role="alert" className="rounded-xl border px-3 py-2 text-xs leading-6"
          style={{ borderColor: 'rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.1)', color: '#FCA5A5' }}>
          {errText}
        </p>
      )}

      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide opacity-70">{t('emailLabel')}</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          dir="ltr"
          placeholder="you@example.com"
          className="w-full rounded-xl border border-white/12 bg-black/30 px-3.5 py-2.5 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-400/60"
          style={{ minHeight: 44 }}
        />
      </label>

      <label className="block">
        <span className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide opacity-70">
          {t('passwordLabel')}
          {/* toggle نمایش/پنهان رمز — دسترسی‌پذیر با aria-pressed */}
          <button type="button" onClick={() => setShowPw((v) => !v)} aria-pressed={showPw}
            className="rounded px-1 text-[10px] normal-case tracking-normal text-cyan-300 hover:underline">
            {showPw ? t('hidePassword') : t('showPassword')}
          </button>
        </span>
        <input
          type={showPw ? 'text' : 'password'}
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          dir="ltr"
          className="w-full rounded-xl border border-white/12 bg-black/30 px-3.5 py-2.5 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-400/60"
          style={{ minHeight: 44 }}
        />
      </label>

      <button
        type="submit"
        disabled={pending || !email || !password}
        aria-busy={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-white shadow-[0_8px_24px_rgba(124,58,237,0.35)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        style={{ minHeight: 46, background: 'linear-gradient(135deg, #7C3AED, #06B6D4)', touchAction: 'manipulation' }}
      >
        {pending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />}
        {pending ? t('signingIn') : t('passwordButton')}
      </button>

      <p className="text-center text-[11px] opacity-60">{t('passwordHint')}</p>
    </form>
  );
}
