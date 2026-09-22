'use client';
import React from 'react';
import { Badge } from '../atoms/Badge';
import { Button } from '../atoms/Button';
import { Icon } from '../atoms/Icon';
import { NEWS_CATEGORIES } from '@/core/config';
import { formatRelative } from '@/utils/date';
import { useNewsStore } from '@/state/newsStore';
import type { Article } from '@/types/news';

export function NewsCard({ article }: { article: Article }) {
  const markRead = useNewsStore((s) => s.markRead);
  const toggleBookmark = useNewsStore((s) => s.toggleBookmark);
  const category = NEWS_CATEGORIES.find((c) => c.id === article.category);
  const categoryColor = category?.color ?? '#7C3AED';

  return (
    <article className={['orbit-glass group relative overflow-hidden rounded-2xl transition-all duration-300','hover:bg-white/[0.07] hover:-translate-y-1 hover:shadow-2xl hover:border-white/10',article.isRead ? 'opacity-70' : ''].join(' ')}>
      {article.imageUrl && (
        <div className="relative aspect-video overflow-hidden bg-black/40">
          <img src={article.imageUrl} alt="" loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          <div className="absolute top-3 right-3">
            <Badge tone="primary" dot>{category?.label ?? article.category}</Badge>
          </div>
        </div>
      )}
      <div className="p-4">
        {!article.imageUrl && (
          <div className="mb-3">
            <Badge tone="primary" dot>{category?.label ?? article.category}</Badge>
          </div>
        )}
        <h3 className="text-sm font-bold leading-6 text-orbit-text line-clamp-2 transition-colors duration-200 group-hover:text-violet-200">{article.title}</h3>
        {article.summary && <p className="mt-2 text-xs leading-6 text-orbit-text-secondary line-clamp-2">{article.summary}</p>}
        <div className="mt-3 flex items-center gap-3 text-2xs text-orbit-text-muted">
          <span className="flex items-center gap-1"><Icon name="clock" size={12} />{formatRelative(article.publishedAt)}</span>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
          <button onClick={() => toggleBookmark(article.id)}
            className={['h-8 w-8 grid place-items-center rounded-lg transition-all duration-200 active:scale-90',article.isBookmarked ? 'text-amber-300 bg-amber-500/10' : 'text-orbit-text-muted hover:text-orbit-text hover:bg-white/5'].join(' ')}
            aria-label="بوکمارک">
            <Icon name={article.isBookmarked ? 'bookmark-fill' : 'bookmark'} size={16} />
          </button>
          <a href={article.url} target="_blank" rel="noopener" onClick={() => markRead(article.id)}>
            <Button variant="ghost" size="sm" iconRight={<Icon name="external" size={14} />}>خواندن</Button>
          </a>
        </div>
      </div>
      <div className="absolute inset-y-0 right-0 w-0.5 opacity-60" style={{ background: categoryColor }} />
    </article>
  );
}
export default NewsCard;