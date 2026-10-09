// src/core/lcpHints.ts — پل RSC بین صفحه و layout برای preload تصویر LCP
//
// FIX — ریشه‌ی LCP=6.9s موبایل: دانلود تصویر کارت اول بعد از hydrate شروع
// می‌شد. صفحه (که آیتم‌ها را prefetch دارد) URL/origin تصویر LCP را در این
// map ماژول-اسکوپ می‌نویسد؛ layout همان را در <head> به‌صورت
// <link rel="preload" as="image"> + preconnect منتشر می‌کند تا دانلود هم‌سطح
// CSS آغاز شود. مقادیر فقط از allowlist https سرور می‌آیند (بدون injection).

export type LcpHint = { url: string; origin: string };

const hints = new Map<string, LcpHint>();

/** Write hint with anti-injection validation (https only, same origin). */
export function setLcpHint(locale: string, hint: LcpHint | null): void {
  if (!hint) return;
  try {
    const u = new URL(hint.url);
    const o = new URL(hint.origin);
    if (u.protocol !== "https:" || o.protocol !== "https:") return;
    if (o.origin !== u.origin) return;
    hints.set(locale, { url: u.toString(), origin: o.origin });
  } catch {
    /* Invalid URL — ignore */
  }
}

export function peekLcpHint(locale: string): LcpHint | null {
  return hints.get(locale) ?? null;
}
