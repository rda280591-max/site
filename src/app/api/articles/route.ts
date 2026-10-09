// src/app/api/articles/route.ts — مقالات منتشرشده ادمین (فقط خواندنی)
// SECURITY: این مسیر فقط در سرور مصرف می‌شود (newsService loopback). ماژول admin
// به next/headers وابسته است و عمداً از گراف Client Components جدا نگه داشته شده.
// کش SWR ۵ دقیقه‌ای + s-maxage هم‌راستا با سیاست /api/rss؛ سقف حجم خروجی ثابت.
import { NextResponse } from 'next/server';
import { getManualArticles } from '@/services/admin/manualArticles';

export const dynamic = 'force-dynamic';

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
};
export async function GET() {
  try {
    const articles = await getManualArticles();
    return NextResponse.json({ articles }, { headers: CACHE_HEADERS });
  } catch {
    // خطای دیتابیس نباید فید خبری را بشکند → لیست خالی با 200.
    return NextResponse.json({ articles: [] }, { headers: CACHE_HEADERS });
  }
}
