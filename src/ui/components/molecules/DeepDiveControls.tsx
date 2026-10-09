// ORBIT — DeepDiveControls: دکمه «مطالعه عمیق» + پنل تمام‌صفحه با focus-trap
// انیمیشن ورود/خروج فقط opacity/transform (composited) → CLS صفر.
'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../atoms/Icon';
import { useCyberStore } from '@/state/cyberStore';

interface Props {
  labels: { deepDive: string; exit: string };
  children: ReactNode;
}

export function DeepDiveControls({ labels, children }: Props) {
  const active = useCyberStore((s) => s.deepDive);
  const setDeepDive = useCyberStore((s) => s.setDeepDive);
  const panelRef = useRef<HTMLDivElement>(null);
  // رندر پنل فقط پس از mount؛ HTML اولیه بدون گره اضافه (agentic-snapshot تمیز)
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // setState در callback زمان‌بندی‌شده — نه بدنه همزمان effect (بدون cascade)
    const id = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  /** Escape خروج + بازگرداندن فوکوس به دکمه فعال‌ساز (رفتار استاندارد dialog). */
  const exit = useCallback(() => {
    setDeepDive(false);
    document.getElementById('deep-dive-trigger')?.focus();
  }, [setDeepDive]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { exit(); return; }
      if (e.key !== 'Tab' || !panelRef.current) return;
      // focus-trap ساده: چرخش بین اولین/آخرین عنصر تمرکزپذیر پنل
      const nodes = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input,textarea,select,[tabindex]:not([tabindex="-1"])',
      );
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [active, exit]);

  return (
    <>
      <button
        id="deep-dive-trigger"
        type="button"
        data-testid="deep-dive-open"
        aria-label={labels.deepDive}
        aria-expanded={active}
        onClick={() => setDeepDive(true)}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-orbit-text-muted hover:text-orbit-text hover:bg-white/5 transition-colors"
      >
        <Icon name="expand" size={14} />
        {labels.deepDive}
      </button>

      {mounted && active ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={labels.deepDive}
          data-testid="deep-dive-panel"
          tabIndex={-1}
          className="orbit-deep-dive-panel outline-none"
        >
          <div className="sticky top-0 z-10 flex justify-end p-4">
            <button
              type="button"
              data-testid="deep-dive-close"
              aria-label={labels.exit}
              onClick={exit}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-bold hover:bg-white/10"
            >
              <Icon name="close" size={14} />
              {labels.exit}
            </button>
          </div>
          <div className="orbit-deep-dive-inner">{children}</div>
        </div>
      ) : null}
    </>
  );
}

export default DeepDiveControls;
