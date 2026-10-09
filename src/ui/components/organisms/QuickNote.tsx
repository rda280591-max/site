'use client';
import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '../atoms/Button';
import { Icon } from '../atoms/Icon';
import { useUIStore } from '@/state/uiStore';
import { useNotesStore } from '@/state/notesStore';

export function QuickNote() {
  const t = useTranslations('notes');
  const tc = useTranslations('common');
  const modal = useUIStore((s) => s.modal);
  const close = useUIStore((s) => s.closeModal);
  const create = useNotesStore((s) => s.create);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const open = modal === 'quickNote';

  useEffect(() => {
    if (!open) return;
    const reset = window.setTimeout(() => {
      setTitle('');
      setBody('');
    }, 0);
    return () => window.clearTimeout(reset);
  }, [open]);
  if (!open) return null;

  const submit = () => {
    if (!body.trim() && !title.trim()) return;
    create({ title: title.trim() || tc('untitled'), body, tags: [] });
    close();
  };

  return (
    /*
      FIX — A11y Tree / Agentic Browsing:
      backdrop کلیک‌پذیر قبلاً <div onClick> بود؛ ایجنت‌های دیداری/کمکی آن را
      به‌عنوان کنترل قابل تعامل در accessibility tree نمی‌دیدند. حالا یک
      <button> تمام‌صفحه‌ی واقعی است که با کیبورد و aria هم قابل شناساییست.
    */
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-24 bg-black/60 backdrop-blur-sm">
      <button
        type="button"
        data-testid="quicknote-backdrop"
        aria-label={tc('cancel')}
        onClick={close}
        className="absolute inset-0 h-full w-full cursor-default"
        tabIndex={-1}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quicknote-title"
        data-testid="quicknote-dialog"
        className="orbit-glass relative w-full max-w-lg rounded-2xl p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id="quicknote-title" className="text-base font-bold flex items-center gap-2">
            <Icon name="note" size={18} className="text-violet-300" />{t('quickTitle')}
          </h3>
          <button onClick={close} data-testid="quicknote-close" aria-label={tc('cancel')} className="h-8 w-8 grid place-items-center rounded-lg hover:bg-white/5"><Icon name="close" size={16} /></button>
        </div>
        <input autoFocus id="quicknote-title-input" data-testid="quicknote-title-input" aria-label={t('titlePlaceholder')} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('titlePlaceholder')}
          className="w-full bg-transparent border-b border-white/10 pb-2 mb-3 text-sm focus:outline-none focus-visible:border-violet-500/50 focus-visible:ring-2 focus-visible:ring-violet-500/30 rounded-sm" />
        <textarea id="quicknote-body-input" data-testid="quicknote-body-input" aria-label={t('bodyPlaceholder')} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('bodyPlaceholder')} rows={5}
          className="w-full resize-none rounded-xl bg-black/20 p-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30" />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={close}>{tc('cancel')}</Button>
          <Button size="sm" onClick={submit}>{tc('save')}</Button>
        </div>
      </div>
    </div>
  );
}
export default QuickNote;