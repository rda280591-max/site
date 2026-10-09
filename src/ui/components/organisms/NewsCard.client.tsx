'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '../atoms/Badge';
import { Button } from '../atoms/Button';
import { Icon } from '../atoms/Icon';
import { NEWS_CATEGORIES } from '@/core/config';
import { useCategoryLabels } from '@/ui/hooks/useCategoryLabels';
import { useFormatters } from '@/ui/hooks/useFormatters';
import { useNewsStore } from '@/state/newsStore';
import { useTranslations, useLocale } from 'next-intl';
import type { Article } from '@/types/news';

export interface Props {
  article: Article;
  /**
   * FIX — LCP
   * اولین کارت مرئی فید تصویرش LCP candidate است.
   * با isLCP=true تصویر eager + sync decode می‌شود.
   */
  isLCP?: boolean;
}

/**
 * هدر گرادیانی اختصاصی برای خبرهای بی‌تصویر/تصویر-شکسته:
 * حرف اول عنوان + پالت رنگ دسته، دقیقاً با همان ارتفاع aspect-video
 * تا چیدمان هرگز جابه‌جا نشود (CLS = 0).
 */
function NewsVisualFallback({ title, color, label }: { title: string; color: string; label: string }) {
  const initial = (title.trim()[0] ?? 'O').toLocaleUpperCase();
  return (
    <div
      className="relative aspect-video overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${color}33 0%, #0B0E17 65%)` }}
      /* FIX a11y — قبلاً کل دیو aria-hidden بود و Badge دسته داخلش هم
         برای screen reader حذف می‌شد. حالا خودِ تزئینات (دات‌گرید،
         گlow، حرف اول عنوان) aria-hidden هستند و برچسب دسته خوانده می‌شود. */
      role="img"
      aria-label={label}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.14]"
        style={{ backgroundImage: `radial-gradient(${color} 1px, transparent 1px)`, backgroundSize: '14px 14px' }}
      />
      <div
        aria-hidden="true"
        className="absolute -top-10 -right-10 h-36 w-36 rounded-full blur-3xl opacity-40"
        style={{ background: color }}
      />
      {/* حرف اول عنوان تزئینی است (عنوان واقعی در <h3> کارت خوانده می‌شود) */}
      <div aria-hidden="true" className="absolute inset-0 grid place-items-center">
        <span
          className="grid h-14 w-14 place-items-center rounded-2xl text-2xl font-black select-none"
          style={{ color, backgroundColor: `${color}1a`, border: `1px solid ${color}40` }}
        >
          {initial}
        </span>
      </div>
      <div className="absolute top-3 right-3">
        <Badge tone="primary" dot>{label}</Badge>
      </div>
    </div>
  );
}

/**
 * FIX — «روی هر جای کارت کلیک کنم خبر را ببینم»:
 * کل کارت (تصویر، عنوان، متن، هر نقطه خالی) یک ناحیه کلیک است و به
 * صفحه جزئیات /news/[id] می‌رود. دکمه bookmark stopPropagation دارد
 * و لینک «خواندن» هم داخل همان مسیریابی است — هیچ تداخلی ندارند.
 * انیمیشن‌ها و ظاهر کارت دقیقاً مثل قبل دست‌نخورده است.
 */
export const NewsCard = React.memo(function NewsCard({ article, isLCP = false }: Props) {
  const t = useTranslations('common');
  // FIX (hydration mismatch): قبلاً زبان alt با خواندن document.documentElement.lang
  // در خود JSX تشخیص داده می‌شد؛ سمت سرور false و سمت کلاینت true → خطای
  // hydration در React. حالا از useLocale() (next-intl) که SSR/CSR یکسان است.
  const localeTag = useLocale();
  const router = useRouter();
  const markRead = useNewsStore((s) => s.markRead);
  const toggleBookmark = useNewsStore((s) => s.toggleBookmark);
  /* FIX UI — «ادامه خبر»: خلاصه‌های بلند RSS تا دو خط clamp شده بودند و متن
     بریده در کارت می‌ماند؛ حالا یک disclosure محلی (بدون رفرش فید) دارد. */
  const [expanded, setExpanded] = useState(false);
  const summaryLong = (article.summary?.length ?? 0) > 140;
  /* Direct membership from the Sets -> O(1) render for this card only */
  const isBookmarked = useNewsStore((s) => s.bookmarkedIds.has(article.id));
  const isRead = useNewsStore((s) => s.readIds.has(article.id)) || article.isRead;
  const { label } = useCategoryLabels();
  const fmt = useFormatters();
  const category = NEWS_CATEGORIES.find((c) => c.id === article.category);
  const categoryColor = category?.color ?? '#7C3AED';
  const categoryLabel = label(article.category);

  function openArticle() {
    markRead(article.id);
    // Locale extracted from the current pathname (/en/... or /fa/...)
    const locale = typeof window !== 'undefined' && /^\/(en|fa)(?:\/|$)/.test(window.location.pathname)
      ? window.location.pathname.split('/')[1]
      : 'en';
    router.push(`/${locale}/news/${encodeURIComponent(article.id)}`);
  }

  // FIX (dead code): پس از تبدیل کارت به <a> واقعی، هندلر کیبورد دستی دیگر
  // استفاده نمی‌شود — لینک بومی Enter/Space را خودش مدیریت می‌کند. حذف شد تا
  // هشدار lint هم صفر شود.

  return (
    <article
      /* FIX a11y — ساختار ARIA نامعتبر: عنصر با role="link" نباید فرزند
         interactive داشته باشد (دکمه‌های bookmark/«ادامه» برای صفحه‌خوان
         حذف یا تعریف‌نشده می‌شدند). حالا article یک group معمولی است و
         ورود به خبر از طریق لینک واقعی <a> روی عنوان انجام می‌شود؛ کلیک
         روی بدنه کارت برای سهولت ماوس حفظ شده (onClick) اما دیگر نقش
         گمراه‌کننده link ندارد. */
      className={[
        'orbit-glass orbit-news-card group relative overflow-hidden rounded-2xl select-none',
        'hover:bg-white/[0.07]',
        'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-violet-400',
        isRead ? 'opacity-70' : '',
      ].filter(Boolean).join(' ')}
    >
      {/* لینک واقعی و قابل‌کیبورد روی کل کارت (cover + عنوان): href حقیقی =
          crawl/middle-click/back-forward cache درست، بدون role جعلی.
          aria-label از t('read') همچنان حفظ می‌شود. */}
      <a
        href={`/${localeTag}/news/${encodeURIComponent(article.id)}`}
        onClick={(e) => {
          // کلیک روی بدنه همان رفتار قبلی (markRead + مسیر نرم) را دارد؛
          // Ctrl/Cmd/middle-click رها می‌شوند تا تب جدید باز شود.
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          openArticle();
        }}
        className="absolute inset-0 z-10"
        aria-label={`${t('read')}: ${article.title}`}
      />
      {article.imageUrl && (
        <div className="relative aspect-video overflow-hidden bg-black/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={article.imageUrl}
            /* Descriptive/semantic alt for Agentic Browsing and screen readers.
               FIX i18n — قبلاً فارسی hard-coded بود و در صفحه /en خوانده می‌شد؛
               حالا به زبان فعال صفحه تولید می‌شود. */
            alt={localeTag.startsWith('fa')
              ? `تصویر خبر «${article.title}» از منبع ${article.source.name}`
              : `Cover image for “${article.title}” via ${article.source.name}`}
            referrerPolicy="no-referrer"
            loading={isLCP ? 'eager' : 'lazy'}
            /* React 19 camelCase prop maps to the DOM fetchpriority attribute */
            fetchPriority={isLCP ? 'high' : 'auto'}
            decoding={isLCP ? 'sync' : 'async'}
            /*
              FIX — LCP موبایل: اگر <link rel=preload as=image> همان URL را
              از قبل داغ کرده، اینجا باید دقیقاً همان src بدون crossorigin
              بخورد تا cache-hit شود (وگرنه preload بی‌مصرف است و دوباره
              دانلود می‌شود). crossOrigin فقط برای preconnect لازم بود که
              آن را هم حذف کردیم؛ img بیرونی بدون CORS رندر می‌شود.
            */
            /* Render only the viewport-sized low-res variant — mobile performance */
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              if (!img.dataset.retried) {
                img.dataset.retried = '1';
                img.src = article.imageUrl! + (article.imageUrl!.includes('?') ? '&' : '?') + 'ts=' + Date.now();
                return;
              }
              const wrap = img.parentElement as HTMLElement | null;
              if (wrap) {
                img.remove();
                wrap.toggleAttribute('data-failed', true);
              }
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          <div className="absolute top-3 right-3">
            <Badge tone="primary" dot>{categoryLabel}</Badge>
          </div>
        </div>
      )}

      {!article.imageUrl && (
        <NewsVisualFallback title={article.title} color={categoryColor} label={categoryLabel} />
      )}

      <div className="p-4">
        <h3 className="text-sm font-bold leading-6 text-orbit-text line-clamp-2 transition-colors duration-200 group-hover:text-violet-100">
          {article.title}
        </h3>

        {article.summary && (
          <p
            id={`ncard-sum-${article.id}`}
            className={[
              'mt-2 text-xs leading-6 text-orbit-text-secondary transition-all duration-200',
              expanded || !summaryLong ? '' : 'line-clamp-2',
            ].join(' ')}
          >
            {article.summary}
          </p>
        )}
        {summaryLong && (
          <button
            type="button"
            aria-expanded={expanded}
            /* FIX a11y — disclosure بدون aria-controls: صفحه‌خوان نمی‌فهمید
               کدام پاراگراف باز/بسته می‌شود. id هم به همان <p> داده شد. */
            aria-controls={`ncard-sum-${article.id}`}
            onClick={(e) => {
              e.stopPropagation(); // کلیک «ادامه» نباید صفحه خبر را باز کند
              setExpanded((v) => !v);
            }}
            className="mt-1 inline-flex items-center gap-1 text-2xs font-bold text-violet-300 transition-colors duration-150 hover:text-violet-200"
          >
            {expanded ? t('readLess') : t('readMore')}
            <Icon name="chevron-down" size={12} className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'} />
          </button>
        )}

        <div className="mt-3 flex items-center gap-3 text-2xs text-orbit-text-muted">
          <span className="flex items-center gap-1">
            <Icon name="clock" size={12} />
            {fmt.relative(article.publishedAt)}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation(); // FIX — کلیک بوکمارک نباید صفحه خبر را باز کند
              toggleBookmark(article.id);
            }}
            /*
             * FIX a11y — دکمه‌ای داخل کارت با role="link": برای تکنولوژی
             * کمکی باید role="button" داشته باشد (وگرنه در ادامه لینک خواناتر
             * می‌شود و state بوکمارک هرگز اعلام نمی‌شد). aria-pressed هم
             * وضعیت toggle را گزارش می‌دهد.
             */
            role="button"
            aria-pressed={isBookmarked}
            aria-label={isBookmarked ? `${t('bookmark')} ✓` : t('bookmark')}
            className={[
              'h-8 w-8 grid place-items-center rounded-lg select-none',
              'transition-[background-color,color] duration-150 active:scale-90',
              isBookmarked
                ? 'text-amber-300 bg-amber-500/10'
                : 'text-orbit-text-muted hover:text-orbit-text hover:bg-white/5',
            ].join(' ')}
          >
            <Icon name={isBookmarked ? 'bookmark-fill' : 'bookmark'} size={16} />
          </button>

          <Button
            variant="ghost"
            size="sm"
            iconRight={<Icon name="external" size={14} />}
            onClick={(e) => {
              e.stopPropagation();
              openArticle();
            }}
          >
            {t('read')}
          </Button>
        </div>
      </div>

      <div
        className="absolute inset-y-0 right-0 w-0.5 opacity-60"
        style={{ background: categoryColor }}
      />
    </article>
  );
});

export default NewsCard;
