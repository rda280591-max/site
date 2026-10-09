// ORBIT — input sanitization
export function stripHtml(input: string): string {
  if (!input) return '';
  if (typeof window === 'undefined') {
    return input.replace(/<[^>]*>/g, '').trim();
  }
  try {
    const doc = new DOMParser().parseFromString(input, 'text/html');
    return (doc.body.textContent ?? '').trim();
  } catch {
    return input.replace(/<[^>]*>/g, '').trim();
  }
}

export function truncate(input: string, max = 160, ellipsis = '…'): string {
  const clean = input.trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + ellipsis;
}

export function normalizePersian(input: string): string {
  return input
    .replace(/[\u064A]/g, 'ی')
    .replace(/[\u0643]/g, 'ک')
    // Keep ZWNJ (zero-width non-joiner); only invisible bidi marks are removed.
    .replace(/[\u200E\u200F]/g, '')
    .replace(/[ \t\u00A0]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .trim();
}

export function sanitizeText(input: string, max = 300): string {
  return truncate(normalizePersian(stripHtml(input)), max);
}

export function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] ?? ch),
  );
}

/**
 * FIX — XSS صفحه جزئیات خبر: تبدیل قطعی HTML/RSS به متن خالص.
 * برخلاف stripHtml (که entityها را «دیکد» می‌کند و خروجی‌اش دوباره قابل
 * پارس HTML است) این تابع پس از حذف تگ‌ها، کاراکترهای حساس را escape هم
 * می‌کند؛ بنابراین رشته‌ای مثل «&amp;lt;script&amp;gt;» در هیچ مصرف‌کننده‌ای
 * (React text یا innerHTML مجدد) به <script> زنده تبدیل نمی‌شود. ترتیب
 * decode → escape ثابت است و double-decode ساختاراً غیرممکن می‌شود.
 */
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
};

export function decodeBasicEntities(s: string): string {
  return s
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/gi, (m, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? m)
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex: string) => {
      const cp = parseInt(hex, 16);
      return Number.isFinite(cp) && cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : _m;
    })
    .replace(/&#(\d+);/g, (_m, dec: string) => {
      const cp = parseInt(dec, 10);
      return Number.isFinite(cp) && cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : _m;
    });
}

export function stripToText(html: string): string {
  if (!html) return '';
  const withoutMarkup = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ');
  // FIX — حلقه بی‌پایان decode/escape: قبلاً decodeBasicEntities پیش از escape
  // اجرا می‌شد؛ ورودی «&amp;lt;b&amp;gt;» به «&lt;b&gt;» تبدیل و سپس دوباره
  // escape می‌گشت → مصرف‌کننده (React text یا innerHTML مجدد) در هر پاس یکی
  // باز می‌کرد و رشته هرگز به نقطه ثابت نمی‌رسید. حالا تا **fixpoint** تکرار
  // می‌شود (هر پاس decode فقط عمق entity را کم می‌کند و رشته کوتاه‌تر می‌شود،
  // پس همگرایی تضمینی است؛ سقف ۵ پاس برای بدنه‌های عجیب). در پایان یک‌بار
  // escape — خروجی همیشه متن خالص با تک-escape است.
  let decoded = withoutMarkup;
  for (let i = 0; i < 5; i++) {
    const next = decodeBasicEntities(decoded);
    if (next === decoded) break;
    decoded = next;
  }
  return escapeHtml(decoded).replace(/\s+/g, ' ').trim();
}