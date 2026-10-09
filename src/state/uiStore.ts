import { create } from 'zustand';

type ModalId = 'quickNote' | 'articleDetail' | 'settings' | null;

interface UIState {
  sidebarOpen: boolean;
  modal: ModalId;
  modalPayload: unknown;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
  openModal: (id: Exclude<ModalId, null>, payload?: unknown) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  sidebarOpen: false,
  modal: null,
  modalPayload: null,

  openSidebar: () => set({ sidebarOpen: true }),
  closeSidebar: () => set({ sidebarOpen: false }),
  toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),

  openModal: (id, payload = null) => set({ modal: id, modalPayload: payload }),
  closeModal: () => set({ modal: null, modalPayload: null }),
}));