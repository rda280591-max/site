// ORBIT — استور «مطالعه عمیق» (Deep Dive Reading Mode)
// NOTE: لایه Cyber-Immersion (پالت‌ها/CRT/Focus Mode) طبق درخواست کاربر به‌طور
// کامل حذف شد؛ این ماژول فقط حالت تمام‌صفحه مطالعه مقاله را نگه می‌دارد.
import { create } from 'zustand';

interface CyberState {
  deepDive: boolean; // موقت، persist نمی‌شود
  setDeepDive: (v: boolean) => void;
}

export const useCyberStore = create<CyberState>((set) => ({
  deepDive: false,
  setDeepDive: (deepDive) => {
    set({ deepDive });
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-deep-dive', deepDive ? 'on' : 'off');
    }
  },
}));
