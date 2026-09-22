'use client';
import { useEffect } from 'react';
import { useNotesStore } from '@/state/notesStore';

export function useNotes(autoInit = true) {
  const notes = useNotesStore((s) => s.notes);
  const status = useNotesStore((s) => s.status);
  const init = useNotesStore((s) => s.init);
  const create = useNotesStore((s) => s.create);
  const update = useNotesStore((s) => s.update);
  const remove = useNotesStore((s) => s.remove);
  const togglePin = useNotesStore((s) => s.togglePin);

  useEffect(() => {
    if (autoInit && status === 'idle') void init();
  }, [autoInit, status, init]);

  return { notes, status, create, update, remove, togglePin };
}