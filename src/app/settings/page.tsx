'use client';
import React, { useSyncExternalStore } from 'react';
import { DashboardLayout } from '@/ui/layouts/DashboardLayout';
import { Card } from '@/ui/components/molecules/Card';
import { useSettingsStore } from '@/state/settingsStore';

export default function SettingsPage() {
  const s = useSettingsStore();
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  if (!mounted) {
    return (
      <DashboardLayout>
        <div className="space-y-6 max-w-3xl">
          <h1 className="text-2xl font-black tracking-tight">تنظیمات</h1>
          <Card title="ظاهر">
            <div className="h-10" />
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <h1 className="text-2xl font-black tracking-tight">تنظیمات</h1>

        <Card title="ظاهر">
          <div className="flex gap-2 flex-wrap">
            {(['dark', 'light', 'system'] as const).map((t) => {
              const active = s.theme === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => s.set('theme', t)}
                     className={[
                       'rounded-xl border px-3 py-1.5 text-xs font-medium transition-all duration-200 active:scale-95',
                       active
                  ? 'border-violet-500/40 bg-violet-500/15 text-white shadow-[0_0_16px_rgba(124,58,237,0.25)]'
                         : 'border-white/10 text-orbit-text-secondary hover:bg-white/5 hover:border-white/20',
                            ].join(' ')}
                >
                  {t === 'dark' ? '🌙 تاریک' : t === 'light' ? '☀️ روشن' : '💻 سیستم'}
                </button>
              );
            })}
          </div>
        </Card>

        <Card title="درباره">
          <p className="text-xs text-orbit-text-secondary">
            ORBIT — مرکز فرماندهی شخصی شما در مدار تکنولوژی
          </p>
          <p className="text-2xs text-orbit-text-muted mt-2">نسخه ۰.۱</p>
        </Card>
      </div>
    </DashboardLayout>
  );
}