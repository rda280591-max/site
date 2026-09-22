'use client';
import React, { useEffect, useState } from 'react';
import { Button } from '../atoms/Button';
import { Icon } from '../atoms/Icon';
import { useUIStore } from '@/state/uiStore';
import { useNotesStore } from '@/state/notesStore';

export function QuickNote() {
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
    create({ title: title.trim() || 'بدون عنوان', body, tags: [] });
    close();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-24 bg-black/60 backdrop-blur-sm" onClick={close}>
      <div onClick={(e) => e.stopPropagation()} className="orbit-glass w-full max-w-lg rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold flex items-center gap-2">
            <Icon name="note" size={18} className="text-violet-300" />یادداشت سریع
          </h3>
          <button onClick={close} className="h-8 w-8 grid place-items-center rounded-lg hover:bg-white/5"><Icon name="close" size={16} /></button>
        </div>
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان (اختیاری)"
          className="w-full bg-transparent border-b border-white/10 pb-2 mb-3 text-sm focus:outline-none focus:border-violet-500/50" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="متن..." rows={5}
          className="w-full resize-none rounded-xl bg-black/20 p-3 text-sm focus:outline-none" />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={close}>انصراف</Button>
          <Button size="sm" onClick={submit}>ذخیره</Button>
        </div>
      </div>
    </div>
  );
}
export default QuickNote;