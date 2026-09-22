// ORBIT — استور یادداشت‌ها
import { create } from 'zustand';
import { createLogger } from '@/core/logger';
import { eventBus } from '@/core/eventBus';
import { indexedDbService } from '@/services/storage/indexedDb';
import { lsGet, lsSet } from '@/services/storage/localStorage';
import { uid } from '@/utils/formatters';
import { isValidNote } from '@/utils/validators';
import type { Note, NoteDraft } from '@/types/notes';

const log = createLogger('state.notes');
const LS_KEY = 'notes:index';

interface NotesState {
  notes: Note[];
  status: 'idle' | 'loading' | 'ready';
  error: string | null;
  init: () => Promise<void>;
  create: (draft: NoteDraft) => Note;
  update: (id: string, patch: Partial<Note>) => void;
  remove: (id: string) => void;
  togglePin: (id: string) => void;
}

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  status: 'idle',
  error: null,

  init: async () => {
    set({ status: 'loading' });
    try {
      const result = await indexedDbService.getAll<Note>('notes');
      let notes: Note[] = result.ok ? result.value.filter(isValidNote) : [];

      if (notes.length === 0) {
        const backup = lsGet<Note[]>(LS_KEY, []);
        notes = backup.filter(isValidNote);
        for (const n of notes) void indexedDbService.put('notes', n);
      }

      notes.sort((a, b) => {
        if (!!b.isPinned !== !!a.isPinned) return b.isPinned ? 1 : -1;
        return b.updatedAt - a.updatedAt;
      });

      set({ notes, status: 'ready' });
      log.info(`تعداد ${notes.length} یادداشت بارگذاری شد.`);
    } catch (e) {
      log.error('بارگذاری یادداشت‌ها ناموفق.', e);
      set({ status: 'ready', error: 'خطا در بارگذاری.' });
    }
  },

  create: (draft) => {
    const now = Date.now();
    const note: Note = {
      id: uid('note'),
      title: draft.title.trim().slice(0, 200),
      body: draft.body,
      tags: draft.tags.slice(0, 10),
      linkedArticleId: draft.linkedArticleId,
      createdAt: now,
      updatedAt: now,
      isPinned: false,
    };
    set((s) => ({ notes: [note, ...s.notes] }));
    void indexedDbService.put('notes', note);
    lsSet(LS_KEY, get().notes);
    eventBus.emit('notes:created', { id: note.id });
    return note;
  },

  update: (id, patch) => {
    set((s) => ({
      notes: s.notes.map((n) =>
        n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n,
      ),
    }));
    const updated = get().notes.find((n) => n.id === id);
    if (updated) {
      void indexedDbService.put('notes', updated);
      lsSet(LS_KEY, get().notes);
      eventBus.emit('notes:updated', { id });
    }
  },

  remove: (id) => {
    set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));
    void indexedDbService.delete('notes', id);
    lsSet(LS_KEY, get().notes);
    eventBus.emit('notes:deleted', { id });
  },

  togglePin: (id) => {
    const note = get().notes.find((n) => n.id === id);
    if (!note) return;
    get().update(id, { isPinned: !note.isPinned });
  },
}));