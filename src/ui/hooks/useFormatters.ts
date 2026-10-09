'use client'

import { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import type { AppLocale } from '@/i18n/routing'
import {
  formatCompact as formatCompactRaw,
  formatNumber as formatNumberRaw,
  formatPercent as formatPercentRaw,
} from '@/utils/formatters'
import {
  formatJalali as formatJalaliRaw,
  formatRelative as formatRelativeRaw,
  formatTime as formatTimeRaw,
  type RelativeUnits,
} from '@/utils/date'

/**
 /* ORBIT — locale-aware formatting
 *
 * چرا هوک؟ توابع utils/formatters و utils/date عمداً زبان را به‌عنوان پارامتر
 * می‌گیرند (بدون حالت سراسری). این هوک آن پارامتر را از next-intl پر می‌کند تا
 * کامپوننت‌ها مجبور نباشند در هر نقطه useLocale را جدا صدا بزنند و پاس بدهند.
 *
 * نتیجه‌ی باگ قبلی: اعداد و تاریخ‌ها در نسخه‌ی انگلیسی هم فارسی می‌ماندند
 * («۱۰» و «۳ روز پیش»)، چون utils به‌صورت ثابت fa-IR و ارقام فارسی تولید می‌کرد.
 */
export function useFormatters() {
  const locale = useLocale() as AppLocale
  const t = useTranslations('time')

  return useMemo(() => {
    // Relative-time units come from the locale dictionary, not hardcoded utils text.
    const units: RelativeUnits = {
      now: t('now'),
      future: t('future'),
      minute: t('minuteAgo'),
      hour: t('hourAgo'),
      day: t('dayAgo'),
      month: t('monthAgo'),
      year: t('yearAgo'),
    }

    return {
      locale,
      number: (value: number) => formatNumberRaw(value, locale),
      compact: (value: number) => formatCompactRaw(value, locale),
      percent: (value: number, digits = 0) => formatPercentRaw(value, digits, locale),
      date: (value: Date | number | string) => formatJalaliRaw(value, locale),
      time: (value: Date | number | string) => formatTimeRaw(value, locale),
      relative: (value: Date | number | string) => formatRelativeRaw(value, locale, units),
    }
  }, [locale, t])
}

export default useFormatters