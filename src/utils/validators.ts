// ORBIT — اعتبارسنجی داده
import type { Article } from '@/types/news';
import type { Note } from '@/types/notes';

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

export function isValidUrl(v: unknown): v is string {
  if (!isNonEmptyString(v)) return false;
  try {
    new URL(v);
    return true;
  } catch {
    return false;
  }
}

export function isValidNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export function isValidArticle(v: unknown): v is Article {
  if (!isPlainObject(v)) return false;
  return (
    isNonEmptyString(v.id) &&
    isNonEmptyString(v.title) &&
    isValidUrl(v.url) &&
    isValidNumber(v.publishedAt)
  );
}

export function isValidNote(v: unknown): v is Note {
  if (!isPlainObject(v)) return false;
  return (
    isNonEmptyString(v.id) &&
    typeof v.body === 'string' &&
    isValidNumber(v.createdAt) &&
    isValidNumber(v.updatedAt)
  );
}

export function filterValid<T>(arr: unknown[], guard: (v: unknown) => v is T): T[] {
  return arr.filter(guard);
}

export function isNonEmptyArray<T>(v: unknown): v is T[] {
  return Array.isArray(v) && v.length > 0;
}