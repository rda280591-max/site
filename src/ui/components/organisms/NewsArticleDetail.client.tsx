'use client';
import React, { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useNewsStore } from '@/state/newsStore';
import { newsService } from '@/services/news/newsService';
import { Icon } from '../atoms/Icon';
import { Badge } from '../atoms/Badge';
import { Button } from '../atoms/Button';
import { NEWS_CATEGORIES } from '@/core/config';
import { useFormatters } from '@/ui/hooks/useFormatters';
import { DeepDiveControls } from '../molecules/DeepDiveControls';
import { stripToText } from '@/utils/sanitize';
import type { Article } from '@/types/news';

export interface Labels {
  back: string;
  readOnSite: string;
  source: string;
  published: string;
  notFoundTitle: string;
  notFoundBody: string;
  loading: string;
  bookmark: string;
  bookmarked: string;
  deepDive: string;
  exit: string;
}

/** بدنه قابل‌استفاده‌مجدد مقاله — هم در صفحه عادی و هم در پنل «مطالعه عمیق» رندر می‌شود. */
function ArticleBody({
  article,
  labels,
  paragraphs,
}: {
  article: Article;
  labels: Labels;
  paragraphs: string[];
}) {
  const category = NEWS_CATEGORIES.find((c) => c.id === article.category);
  const fmt = useFormatters();
  return (
    <>
      <header className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {category && <Badge tone="primary" dot>{category.id}</Badge>}
          <span className="text-2xs text-orbit-text-muted flex items-center gap-1">
            <Icon name="clock" size={12} />
            {labels.published}: {fmt.relative(article.publishedAt)}
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-black leading-8 tracking-tight text-orbit-text">
          {article.title}
        </h1>
        <p className="text-xs text-orbit-text-secondary">
          {labels.source}: <strong>{article.source.name}</strong>
          {article.author ? ` — ${article.author}` : ''}
        </p>
      </header>

      {/* بدنه خبر */}
      <div className="space-y-4 text-sm leading-7 text-orbit-text-secondary">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      {/* لینک اصلی منبع */}
      <footer className="border-t border-white/5 pt-5">
        <a href={article.url} target="_blank" rel="noopener noreferrer">
          <Button variant="primary" iconRight={<Icon name="external" size={14} />} className="w-full sm:w-auto">
            {labels.readOnSite}
          </Button>
        </a>
      </footer>
    </>
  );
}

interface Props {
  articleId: string;
  labels: Labels;
}

/**
 * FIX — XSS صفحه جزئیات خبر: stripHtml محلی قبلاً entityها را decode می‌کرد
 * و خروجی دوباره قابل HTML-پارس بود؛ رشته «&amp;lt;script&amp;gt;» در پاس دوم
 * به <script> زنده تبدیل می‌شد (double-decode). حالا از stripToText مشترک
 * استفاده می‌شود: decode کامل → escape یکتا؛ خروجی همیشه متن خالص است.
 */
function toParagraphs(text: string): string[] {
  if (!text) return [];
  // برش روی مرزهای پاراگرافِ خام، سپس تبدیل هر قطعه به متن امن
  const parts = text
    .split(/<\/p>\s*<p[^>]*>|<br\s*\/?>|<\/div>\s*<div[^>]*>/i)
    .map(stripToText)
    .filter((p) => p.length > 40);
  const clean = stripToText(text);
  return parts.length ? parts : clean ? [clean] : [];
}

export function NewsArticleDetail({ articleId, labels }: Props) {
  const articles = useNewsStore((s) => s.articles);
  const markRead = useNewsStore((s) => s.markRead);
  const toggleBookmark = useNewsStore((s) => s.toggleBookmark);
  const isBookmarked = useNewsStore((s) => s.bookmarkedIds.has(articleId));
  // FIX — "bookmark disappears after refresh": fresh seed/fetch articles lack their own
  // isBookmarked flag; local Set membership must be OR-ed in.
  // A single array find (no triple O(n) loop).
  const feedMatch = useMemo(
    () => articles.find((a) => a.id === articleId) ?? null,
    [articles, articleId],
  );

  const [fetched, setFetched] = useState<Article | null>(null);
  const [fetchState, setFetchState] = useState<'idle' | 'loading' | 'ready' | 'missing'>('idle');

  const inFeed = useMemo(
    () => (feedMatch ? { ...feedMatch, isBookmarked: feedMatch.isBookmarked || isBookmarked } : null),
    [feedMatch, isBookmarked],
  );

  /* وضعیت نهایی بدون setState حین effect:
     در store باشد → آماده؛ نتیجه fetch هم OR membership. */
  const state = inFeed ? 'ready' : fetchState === 'idle' ? 'loading' : fetchState;
  const article = useMemo(
    () => inFeed ?? (fetched ? { ...fetched, isBookmarked: fetched.isBookmarked || isBookmarked } : null),
    [inFeed, fetched, isBookmarked],
  );

  /* markRead fires once per article — outside the render/effect cascade loop */
  const markedRef = useRef<string | null>(null);
  useEffect(() => {
    if (state !== 'ready' || markedRef.current === articleId) return;
    markedRef.current = articleId;
    markRead(articleId);
  }, [state, articleId, markRead]);

  /* ۲) نبود → fetch تازه (کاربر لینک را مستقیم باز کرده یا reload زده)
     فقط وقتی در store نیست اجرا می‌شود؛ setStateها داخل callback async
     هستند نه بدنه همزمان effect. */
  const needsFetch = !inFeed && fetchState === 'idle';
  useEffect(() => {
    if (!needsFetch) return;
    let cancelled = false;
    // transition keeps setFetchState('loading') from creating a blocking cascade
    startTransition(() => setFetchState('loading'));
    void (async () => {
      try {
        // Fetch the first few feed pages so the target item is found
        const res = await newsService.fetch({ pageSize: 100 });
        if (cancelled) return;
        if (res.ok) {
          const found = res.value.articles.find((a) => a.id === articleId) ?? null;
          setFetched(found);
          setFetchState(found ? 'ready' : 'missing');
        } else {
          setFetchState('missing');
        }
      } catch {
        if (!cancelled) setFetchState('missing');
      }
    })();
    return () => { cancelled = true; };
  }, [needsFetch, articleId]);

  if (state === 'loading') {
    return (
      <div className="orbit-glass rounded-2xl p-8 space-y-4" aria-busy="true" aria-live="polite">
        <div className="h-6 w-2/3 rounded bg-white/10 animate-pulse" />
        <div className="aspect-video rounded-xl bg-white/5 animate-pulse" />
        <div className="h-4 w-full rounded bg-white/5 animate-pulse" />
        <div className="h-4 w-5/6 rounded bg-white/5 animate-pulse" />
        <p className="text-xs text-orbit-text-muted">{labels.loading}</p>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="orbit-glass rounded-2xl p-10 text-center space-y-4">
        <div className="text-4xl">🛰️</div>
        <h2 className="text-lg font-bold">{labels.notFoundTitle}</h2>
        <p className="text-sm text-orbit-text-secondary mx-auto max-w-md">{labels.notFoundBody}</p>
        <Link href="./" scroll={false}>
          <Button variant="secondary">{labels.back}</Button>
        </Link>
      </div>
    );
  }

  const category = NEWS_CATEGORIES.find((c) => c.id === article.category);
  const paragraphs = toParagraphs(article.content || article.summary || '');

  return (
    <article className="orbit-fade-up orbit-glass overflow-hidden rounded-2xl">
      {/* هدر تصویر — همان ارتفاع aspect-video کارت‌ها */}
      {article.imageUrl ? (
        <div className="relative aspect-video max-h-[420px] w-full overflow-hidden bg-black/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={article.imageUrl}
            /* Descriptive alt for Agentic Browsing / readers (i18n-aware). */
            alt={typeof document !== 'undefined' && document.documentElement.lang.startsWith('fa')
              ? `تصویر خبر «${article.title}» از منبع ${article.source.name}`
              : `Cover image for “${article.title}” via ${article.source.name}`}
            referrerPolicy="no-referrer"
            loading="eager"
            fetchPriority="high"
            decoding="sync"
            sizes="(max-width: 768px) 100vw, 840px"
            className="h-full w-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        </div>
      ) : (
        <div
          className="h-2 w-full"
          style={{ background: `linear-gradient(90deg, ${category?.color ?? '#7C3AED'}, transparent)` }}
          aria-hidden="true"
        />
      )}

      <div className="p-5 sm:p-8 space-y-5">
        {/* ردیف بالا: بازگشت + مطالعه عمیق + بوکمارک */}
        <div className="flex items-center justify-between gap-3">
          <Link
            href="./"
            scroll={false}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-orbit-text-muted transition-colors duration-150 hover:text-orbit-text"
          >
            {/*
              FIX UI — جهت فلش «بازگشت» در RTL:
              قبلاً chevron-right با ltr:rotate-180 استفاده می‌شد که در LTR
              به ‏← (درست) ولی در RTL هم همان ← می‌ماند؛ الگوی استاندارد
              Tailwind برای آیکون جهت‌دار، چرخاندن در RTL است نه LTR.
            */}
            <Icon name="chevron-left" size={14} className="hidden rtl:block" />
            <Icon name="chevron-right" size={14} className="ltr:block rtl:hidden" />
            {labels.back}
          </Link>
          <div className="flex items-center gap-2">
            <DeepDiveControls labels={{ deepDive: labels.deepDive, exit: labels.exit }}>
              <ArticleBody article={article} labels={labels} paragraphs={paragraphs} />
            </DeepDiveControls>
            <button
              type="button"
              onClick={() => toggleBookmark(article.id)}
              className={[
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold select-none',
                'transition-[background-color,color] duration-150 active:scale-95',
                isBookmarked ? 'text-amber-300 bg-amber-500/10' : 'text-orbit-text-muted hover:text-orbit-text hover:bg-white/5',
              ].join(' ')}
              aria-label={isBookmarked ? labels.bookmarked : labels.bookmark}
            >
              <Icon name={isBookmarked ? 'bookmark-fill' : 'bookmark'} size={14} />
              {isBookmarked ? labels.bookmarked : labels.bookmark}
            </button>
          </div>
        </div>

        {/* بدنه مقاله — همان ArticleBody در حالت عادی */}
        <ArticleBody article={article} labels={labels} paragraphs={paragraphs} />
      </div>
    </article>
  );
}

export default NewsArticleDetail;
