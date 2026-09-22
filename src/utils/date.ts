// ORBIT — ابزارهای تاریخ
import { BRAND } from '@/core/config';

export function toDate(value: Date | number | string): Date | null {
  try {
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export function formatJalali(value: Date | number | string): string {
  const d = toDate(value);
  if (!d) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Tehran',
    }).format(d);
  } catch {
    return d.toLocaleDateString(BRAND.locale);
  }
}

export function formatTime(value: Date | number | string): string {
  const d = toDate(value);
  if (!d) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tehran',
    }).format(d);
  } catch {
    return d.toLocaleTimeString(BRAND.locale);
  }
}

export function formatRelative(value: Date | number | string): string {
  const d = toDate(value);
  if (!d) return '—';
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 0) return 'آینده';
  if (sec < 60) return 'همین حالا';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} دقیقه پیش`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ساعت پیش`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} روز پیش`;
  const mon = Math.floor(day / 30);
  if (mon < 12) return `${mon} ماه پیش`;
  return `${Math.floor(mon / 12)} سال پیش`;
}

export function isToday(value: Date | number | string): boolean {
  const d = toDate(value);
  if (!d) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}