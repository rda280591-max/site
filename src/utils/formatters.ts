// ORBIT — قالب‌بندی اعداد
const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return toPersianDigits(value.toLocaleString('en-US'));
}

export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs < 1000) return toPersianDigits(value);
  if (abs < 1_000_000) return `${toPersianDigits((value / 1000).toFixed(1))} هزار`;
  if (abs < 1_000_000_000) return `${toPersianDigits((value / 1_000_000).toFixed(1))} میلیون`;
  return `${toPersianDigits((value / 1_000_000_000).toFixed(1))} میلیارد`;
}

export function formatPercent(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '—';
  return `${toPersianDigits(value.toFixed(digits))}٪`;
}

export function safeString(value: unknown, fallback = '—'): string {
  if (value === null || value === undefined) return fallback;
  const s = String(value).trim();
  return s.length ? s : fallback;
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}