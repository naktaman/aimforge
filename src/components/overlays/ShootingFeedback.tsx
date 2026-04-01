/**
 * 사격 피드백 오버레이
 * 클릭 시: 머즐 플래시 + 히트마커 (명중 시) or 미스 마커
 * CSS 애니메이션으로 짧은 시각 피드백 제공
 */
import { useState, useCallback, useEffect, useRef } from 'react';

/** 피드백 이벤트 타입 */
interface FeedbackEvent {
  id: number;
  type: 'hit' | 'miss' | 'flash';
  timestamp: number;
}

/** 전역 피드백 트리거 (외부에서 호출) */
let globalTrigger: ((type: 'hit' | 'miss') => void) | null = null;

/** 외부에서 사격 피드백을 트리거하는 함수 */
export function triggerShootingFeedback(type: 'hit' | 'miss'): void {
  globalTrigger?.(type);
}

export function ShootingFeedback() {
  const [events, setEvents] = useState<FeedbackEvent[]>([]);
  const nextId = useRef(0);

  /** 피드백 이벤트 추가 */
  const addFeedback = useCallback((type: 'hit' | 'miss') => {
    const now = Date.now();
    const id = nextId.current++;
    // 머즐 플래시 + 히트/미스 마커 동시에
    setEvents((prev) => [
      ...prev,
      { id, type: 'flash', timestamp: now },
      { id: id + 1, type, timestamp: now },
    ]);
    nextId.current++;

    // 300ms 후 자동 제거
    window.setTimeout(() => {
      setEvents((prev) => prev.filter((e) => e.id !== id && e.id !== id + 1));
    }, 300);
  }, []);

  // 전역 트리거 등록
  useEffect(() => {
    globalTrigger = addFeedback;
    return () => { globalTrigger = null; };
  }, [addFeedback]);

  if (events.length === 0) return null;

  return (
    <div className="shooting-feedback-overlay">
      {events.map((evt) => {
        if (evt.type === 'flash') {
          return <div key={evt.id} className="muzzle-flash" />;
        }
        if (evt.type === 'hit') {
          return (
            <div key={evt.id} className="hitmarker">
              {/* X자 히트마커 */}
              <svg width="32" height="32" viewBox="0 0 32 32">
                <line x1="6" y1="6" x2="12" y2="12" stroke="white" strokeWidth="2.5" />
                <line x1="20" y1="6" x2="26" y2="12" stroke="white" strokeWidth="2.5" />
                <line x1="6" y1="26" x2="12" y2="20" stroke="white" strokeWidth="2.5" />
                <line x1="20" y1="26" x2="26" y2="20" stroke="white" strokeWidth="2.5" />
              </svg>
            </div>
          );
        }
        // miss — 얇은 원형
        return (
          <div key={evt.id} className="miss-marker">
            <svg width="24" height="24" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="rgba(255,100,100,0.7)" strokeWidth="1.5" fill="none" />
            </svg>
          </div>
        );
      })}
    </div>
  );
}
