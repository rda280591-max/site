'use client';

import { useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { NEWS_CATEGORIES, type NewsCategoryId } from '@/core/config';

/**
 /* ORBIT — category labels from the locale dictionary
 *
 * قبلاً برچسب‌ها داخل NEWS_CATEGORIES به فارسی هاردکد شده بودند و در نسخه‌ی
 * انگلیسی هم فارسی می‌ماندند. الان config فقط id و رنگ را نگه می‌دارد و متن از
 * messages/{locale}.json (namespace «categories») می‌آید.
 *
 * نکته‌ی i18n: کلیدها از قبل ثابت‌اند، پس dynamic key در useTranslations
 * استفاده نمی‌کنیم (next-intl فقط کلیدهای استاتیک را تایپ‌چک می‌کند و
 * namespace را هم باید صریح بدهیم).
 */
/*
 * FIX — سرعت سوییچ بین دکمه‌ها: قبلاً هر فراخوانی این هوک در هر رندر،
 * آبجکت labels و آرایه categories تازه می‌ساخت؛ چون Sidebar/NewsCard/
 * CategoryWidget/Tabs همه از آن استفاده می‌کنند، React.memo روی NewsCard
 * بی‌اثر می‌شد و با هر state کوچک، کل فید دوباره رندر می‌شد. حالا خروجی
 * memoized است و مرجع‌ها پایدارند.
 */
export function useCategoryLabels() {
  const t = useTranslations('categories');

  const labels = useMemo<Record<NewsCategoryId, string>>(
    () => ({
      ai: t('ai'),
      gadgets: t('gadgets'),
      software: t('software'),
      hardware: t('hardware'),
      security: t('security'),
      space: t('space'),
      startups: t('startups'),
    }),
    // t is stable per locale; a locale change remounts the layout, so this dep suffices
    [t],
  );

  const categories = useMemo(
    () => NEWS_CATEGORIES.map((c) => ({ ...c, label: labels[c.id] })),
    [labels],
  );

  const label = useCallback(
    (id: NewsCategoryId | string): string =>
      (labels as Record<string, string>)[id] ?? String(id),
    [labels],
  );

  return { labels, label, categories };
}

export default useCategoryLabels;
