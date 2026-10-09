'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { formatTime } from '@/utils/date';

/**
 * FIX (UI زنده): ساعت زنده هدر داشبورد — حس «پنل live بودن» بدون WebSocket.
 * hydration-safe: مقدار اولیه null است و بعد از mount پر می‌شود؛ بنابراین
 * سرور هیچ متنی رندر نمی‌کند و mismatch رخ نمی‌دهد. interval یک‌ثانیه‌ای
 * هنگام پنهان بودن تب متوقف می‌شود (visibilitychange) — باتر.
 */
export default function AdminLiveClock() {
  const locale = useLocale();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let id: number | undefined;
    const tick = () => setNow(Date.now());
    const start = () => { if (id === undefined) { tick(); id = window.setInterval(tick, 1000); } };
    const stop = () => { if (id !== undefined) { window.clearInterval(id); id = undefined; } };
    const onVis = () => (document.hidden ? stop() : start());
    start();
    document.addEventListener('visibilitychange', onVis);
    return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  if (now === null) return <span className="w-[68px]" aria-hidden />; // placeholder عرض ثابت → CLS صفر

  return (
    <time dateTime={new Date(now).toISOString()} dir="ltr"
      className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[11px] tabular-nums text-slate-300">
      {formatTime(now, locale === 'fa' ? 'fa' : 'en')}
    </time>
  );
}
