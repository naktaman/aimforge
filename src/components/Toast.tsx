/**
 * 전역 토스트 알림 컴포넌트
 * 우하단 고정, 자동 소멸, 타입별 색상
 */
import { useToastStore } from '../stores/toastStore';

export function Toast() {
  const { toasts, removeToast } = useToastStore();
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast--${t.type}`}
          onClick={() => removeToast(t.id)}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
