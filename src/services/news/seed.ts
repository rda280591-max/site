// ORBIT — نقطه ورود seed امن برای HTML اولیه (بدون زنجیره سروری)
//
// FIX build: صفحه‌های RSC قبلاً buildArticleSeedForHtml را مستقیم از newsService
// import می‌کردند؛ آن ماژول به rssProvider → feeds.server وابسته است و ایندایرکت
// serverClient (next/headers) را وارد گراف رندر کلاینت می‌کرد → Turbopack خطا.
// این فایل فقط به normalize‌گر خالص وصل است و برای هر دو طرف (سرور/کلاینت) safe است.

import type { RssItem } from './feedCore';
import type { Article } from '@/types/news';
import { buildArticlesFromRssItems } from './articleNormalizer';

export function buildArticleSeedForHtml(items: RssItem[]): Article[] {
  if (items.length === 0) return [];
  try {
    return buildArticlesFromRssItems(items);
  } catch {
    return [];
  }
}
