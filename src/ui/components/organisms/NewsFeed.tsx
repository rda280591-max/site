'use client';
import React, { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { NewsCard } from './NewsCard.client';
import { Button } from '../atoms/Button';
import { Icon } from '../atoms/Icon';
import { ErrorBoundary } from '../feedback/ErrorBoundary';
import { useNewsStore } from '@/state/newsStore';

export const NewsFeed = React.memo(function NewsFeed() {
  const t = useTranslations('feed');
  const articles = useNewsStore((s) => s.articles);
  const status   = useNewsStore((s) => s.status);
  const error    = useNewsStore((s) => s.error);
  const refresh  = useNewsStore((s) => s.refresh);
  const loadMore = useNewsStore((s) => s.loadMore);
  const total    = useNewsStore((s) => s.total);

  useEffect(() => {
    // FIX — mobile LCP: if the store was created before the seed tag was inserted, apply
    // the server data right here (before any fetch); refresh becomes unnecessary and
    // NewsFeed paints the cards on the very first render.
    if (status === 'idle') useNewsStore.getState().seededFromDom?.();
  }, [status]);

  useEffect(() => {
    if (useNewsStore.getState().status === 'idle') void refresh();
  }, [refresh]);

  if (status === 'loading' && articles.length === 0) {
    return (
      /*
        FIX — Agentic Browsing / LLM Reader:
        ایجنت‌های متنی و vision-based هنگام رندر اولیه باید بفهمند این ناحیه
        «در حال بارگذاری محتوای زنده» است، نه اینکه با یک گرید خالیِ aria-hidden
        مواجه شوند. role=status + aria-live polite + متن توصیفی جایگزین، بدون
        آنکه هندسه (CLS صفر) تغییر کند.
      */
      <div
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        role="status"
        aria-busy="true"
        aria-live="polite"
      >
        <p className="sr-only">{t('loading')}</p>
        {/*
          FIX — CLS صفر مطلق:
          اسکلتون دقیقاً با همان هندسه کارت واقعی ساخته می‌شود:
          aspect-video برای تصویر + بلوک p-4 با ارتفاع‌های ثابت (h-6/h-12/…)
          تا لحظه لود محتوای واقعی هیچ پرش چیدمانی رخ ندهد.
        */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="orbit-glass rounded-2xl overflow-hidden" aria-hidden="true">
            <div className="orbit-skeleton aspect-video w-full rounded-none" />
            <div className="p-4 space-y-3">
              <div className="h-6 w-[85%] rounded bg-white/[0.07]" />
              <div className="h-6 w-[60%] rounded bg-white/[0.07]" />
              <div className="h-3 w-full rounded bg-white/[0.05]" />
              <div className="h-3 w-3/5 rounded bg-white/[0.05]" />
              <div className="flex items-center justify-between border-t border-white/5 pt-3">
                <div className="h-8 w-8 rounded-lg bg-white/[0.05]" />
                <div className="h-8 w-24 rounded-lg bg-white/[0.05]" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (status === 'error' && articles.length === 0) {
    return (
      <div className="orbit-glass rounded-2xl p-8 text-center">
        <div className="text-4xl mb-3">📡</div>
        <h3 className="text-base font-bold mb-2">{t('errorTitle')}</h3>
        <p className="text-xs text-orbit-text-secondary mb-4">{error}</p>
        <Button onClick={() => void refresh()} iconLeft={<Icon name="refresh" size={16} />}>
          {t('retry')}
        </Button>
      </div>
    );
  }

  if (status === 'success' && articles.length === 0) {
    return (
      <div className="orbit-glass rounded-2xl p-10 text-center">
        <div className="text-4xl mb-3">🔍</div>
        <p className="text-sm text-orbit-text-secondary">{t('empty')}</p>
      </div>
    );
  }

  return (
    <ErrorBoundary scope="NewsFeed">
      {/*
        FIX — سرعت سوییچ بین دکمه‌های دسته: قبلاً با تغییر دسته، آرایه خالی
        می‌شد و کل فید جایش را به ۶ اسکلتون می‌داد (فلش + پرش). حالا تا
        رسیدن پاسخ جدید، محتوای قبلی با opacity کم‌رنگ روی صفحه می‌ماند؛
        بدون جابه‌جایی layout و بدون چشم‌برهم‌خوردگی.
      */}
      <div
        className="space-y-4 transition-opacity duration-200"
        style={{ opacity: status === 'loading' && articles.length > 0 ? 0.55 : 1 }}
        aria-busy={status === 'loading'}
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {articles.map((a, idx) => (
            <NewsCard
              key={a.id}
              article={a}
              /*
               * FIX — LCP
               * اولین کارت (idx===0) تصویرش اغلب LCP element است.
               * با isLCP=true → loading="eager" decoding="sync" در NewsCard.
               */
              isLCP={idx === 0}
            />
          ))}
        </div>
        {articles.length < total && (
          <div className="flex justify-center pt-4">
            <Button
              variant="secondary"
              loading={status === 'loading'}
              onClick={() => void loadMore()}
            >
              {t('loadMore')}
            </Button>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
});

export default NewsFeed;
