/**
 * 토스트 알림 스토어 (zustand)
 * 앱 전역 알림 메시지 관리
 */
import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastState {
  toasts: ToastItem[];
  /** 토스트 추가 — 자동 ID 생성, 기본 3초 */
  addToast: (message: string, type?: ToastType, duration?: number) => void;
  /** 토스트 제거 */
  removeToast: (id: string) => void;
}

let toastCounter = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (message, type = 'info', duration = 3000) => {
    const id = `toast-${++toastCounter}-${Date.now()}`;
    set((s) => ({ toasts: [...s.toasts, { id, message, type, duration }] }));
    // 자동 소멸
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, duration);
  },

  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
