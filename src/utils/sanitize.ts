// ORBIT — پاکسازی ورودی‌ها
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
    .replace(/[\u200C\u200F\u200E]/g, '')
    .replace(/\s+/g, ' ')
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