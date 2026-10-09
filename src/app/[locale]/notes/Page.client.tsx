'use client';
import React from 'react';
import { useTranslations } from 'next-intl';
import { DashboardLayout } from '@/ui/layouts/DashboardLayout';
import { Card } from '@/ui/components/molecules/Card';
import { Button } from '@/ui/components/atoms/Button';
import { Icon } from '@/ui/components/atoms/Icon';
import { useNotes } from '@/modules/notes/hooks/useNotes';
import { useUIStore } from '@/state/uiStore';
import { useFormatters } from '@/ui/hooks/useFormatters';

function NotesPage() {
  const t = useTranslations('notes');
  const { notes, remove, togglePin } = useNotes();
  const openModal = useUIStore((s) => s.openModal);
  const fmt = useFormatters();

  return (
    <DashboardLayout requireAuth={false}>
      <div className="space-y-5">
        <div className="orbit-fade-up flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight">{t('title')}</h1>
            <p className="text-xs text-orbit-text-muted mt-1">{t('subtitle')}</p>
          </div>
          <Button onClick={() => openModal('quickNote')} iconLeft={<Icon name="note" size={16} />}>
            {t('new')}
          </Button>
        </div>
        {notes.length === 0 ? (
          <Card>
            <div className="text-center py-10">
              <div className="text-4xl mb-3">📝</div>
              <p className="text-sm text-orbit-text-secondary">{t('empty')}</p>
            </div>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {notes.map((n) => (
              <Card
                key={n.id}
                title={n.title}
                subtitle={fmt.relative(n.updatedAt)}
                action={
                  <div className="flex gap-1">
                    <button onClick={() => togglePin(n.id)}
                      className="h-7 w-7 grid place-items-center rounded-lg hover:bg-white/5">
                      <Icon name={n.isPinned ? 'bookmark-fill' : 'bookmark'} size={14} />
                    </button>
                    <button onClick={() => remove(n.id)}
                      className="h-7 w-7 grid place-items-center rounded-lg hover:bg-white/5 text-red-300">
                      <Icon name="close" size={14} />
                    </button>
                  </div>
                }
              >
                <p className="text-xs text-orbit-text-secondary leading-6 line-clamp-4 whitespace-pre-wrap">
                  {n.body || '—'}
                </p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default NotesPage;
