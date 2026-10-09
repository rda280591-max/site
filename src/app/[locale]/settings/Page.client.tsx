'use client';
import React from 'react';
import { useTranslations } from 'next-intl';
import { DashboardLayout } from '@/ui/layouts/DashboardLayout';
import { Card } from '@/ui/components/molecules/Card';
import { useSettingsStore } from '@/state/settingsStore';

function SettingsPage() {
  const t = useTranslations('settings');
  const s = useSettingsStore();

  // FIX — «دکمه‌های پنل تم در صفحه تنظیمات دیده نمی‌شوند»: قبلاً کل محتوا پشت
  // گیت mounted (useSyncExternalStore) پنهان بود و HTML اولیه فقط یک اسکلتون
  // خالی داشت؛ اگر JS/hydration کامل نمی‌شد کاربر صفحه سفید می‌دید. حالا همه
  // دکمه‌ها از همان رندر سرور وجود دارند؛ zustand روی SSR مقدار پیش‌فرض امن
  // برمی‌گرداند و بعد از hydrate، مقدار واقعی localStorage اعمال می‌شود.
  const themeLabels = {
    dark: t('themeDark'),
    light: t('themeLight'),
    system: t('themeSystem'),
  } as const;

  return (
    <DashboardLayout requireAuth={false}>
      <div className="space-y-6 max-w-3xl">
        <h1 className="text-2xl font-black tracking-tight">{t('title')}</h1>

        <Card title={t('appearance')}>
          <div className="flex gap-2 flex-wrap">
              {(['dark', 'light', 'system'] as const).map((mode) => {
                const active = s.theme === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => s.set('theme', mode)}
                    className={[
                      'rounded-xl border px-3 py-1.5 text-xs font-medium select-none',
                      'will-change-transform transform-gpu transition-[transform,background-color,border-color,box-shadow,color] duration-200 ease-out active:scale-95',
                      active ? 'border-orbit-primary bg-orbit-primary/10' : '',
                      active
                        ? 'text-[var(--orbit-text)]'
                        : 'border-[var(--orbit-border)] text-orbit-text-secondary hover:bg-white/5 hover:border-[var(--orbit-border-strong,var(--orbit-border))]',
                    ].join(' ')}
                  >
                    {themeLabels[mode]}
                  </button>
                );
              })}
          </div>
        </Card>

        <Card title={t('about')}>
          <p className="text-xs text-orbit-text-secondary">{t('aboutText')}</p>
          <p className="text-2xs text-orbit-text-muted mt-2">{t('version')}</p>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export default SettingsPage;
