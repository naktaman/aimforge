/**
 * 전역 토스트 알림 컴포넌트
 * 우하단 고정, 자동 소멸, 타입별 색상
 */
import { useToastStore, type ToastType } from '../stores/toastStore';

/** 타입별 배경색 */
const BG: Record<ToastType, string> = {
  success: '#166534',
  error: '#991b1b',
  info: '#1e40af',
  warning: '#92400e',
};

const BORDER: Record<ToastType, string> = {
  success: '#4ade80',
  error: '#f87171',
  info: '#60a5fa',
  warning: '#fbbf24',
};

export function Toast() {
  const { toasts, removeToast } = useToastStore();
  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360,
    }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            background: BG[t.type],
            border: `1px solid ${BORDER[t.type]}`,
            borderRadius: 8,
            padding: '10px 16px',
            color: '#fff',
            fontSize: 13,
            lineHeight: 1.4,
            cursor: 'pointer',
            animation: 'toastSlideIn 0.25s ease-out',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}
          onClick={() => removeToast(t.id)}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
