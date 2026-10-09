import { cache } from 'react';
import { getAdminClient } from './serverClient';

export interface ManualArticleDto {
  id: string; title: string; description: string | null; url: string;
  urlToImage: string | null; publishedAt: string | null; author: string | null;
  content: string | null; source: { id: string | null; name: string };
  /**
   * FIX — آمار نادرست داشبورد: این DTO فقط فیلدهای RSS-مانند دارد و قبلاً
   * category/is_published در select نبود؛ مصرف‌کننده loopback (/api/articles)
   * هم آن‌ها را دور می‌ریخت → مقالات دستی هرگز در ویجت دسته‌ها و نمودار
   * مقایسه آنالیتیکس شمرده نمی‌شدند. حالا به‌صورت optional منتقل می‌شوند تا
   * newsService بتواند آن‌ها را فیلتر/دسته‌بندی کند.
   */
  category?: string | null;
  isPublished?: boolean;
}

/**
 * مقالات دستی منتشرشده ادمین (جدول articles).
 * - cache() → حداکثر یک‌بار در هر رندر سرور.
 * - خطای دیتابیس هرگز نباید فید RSS را بشکند → آرایه خالی.
 */
export const getManualArticles = cache(async (): Promise<ManualArticleDto[]> => {
  try {
    const supabase = await getAdminClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('articles')
      .select('id,title,summary,url,image_url,published_at,author,body,source_name,category,is_published')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(50);
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      title: String(r.title ?? ''),
      description: (r.summary as string) || null,
      url: String(r.url ?? ''),
      urlToImage: (r.image_url as string) || null,
      publishedAt: (r.published_at as string) || null,
      author: (r.author as string) || null,
      content: (r.body as string) || null,
      source: { id: null, name: String(r.source_name ?? 'ORBIT') },
      category: (r.category as string) || null,
      isPublished: r.is_published !== false,
    }));
  } catch {
    return [];
  }
});
