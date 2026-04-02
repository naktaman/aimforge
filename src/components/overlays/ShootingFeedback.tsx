/**
 * 사격 피드백 오버레이
 * 히트마커 (body/headshot 구분) + 미스마커 + 머즐 플래시 + 스코어 팝업 + 콤보 시스템
 * CSS 애니메이션으로 즉각적인 시각 피드백 제공
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import type { HitZone } from '../../utils/types';

/** 피드백 이벤트 타입 */
type FeedbackType = 'hit' | 'headshot' | 'miss' | 'flash';

interface FeedbackEvent {
  id: number;
  type: FeedbackType;
  timestamp: number;
}

/** 스코어 팝업 이벤트 */
interface ScorePopup {
  id: number;
  points: number;
  isHeadshot: boolean;
  timestamp: number;
}

/** 콤보 상태 */
interface ComboState {
  count: number;
  lastHitTime: number;
  /** 콤보 기반 피치 배율 (1.0 ~ 1.5) */
  pitchMultiplier: number;
}

/** 콤보 타임아웃 (ms) — 이 시간 내에 다음 히트가 없으면 리셋 */
const COMBO_TIMEOUT = 1500;
/** 콤보당 피치 증가량 */
const COMBO_PITCH_STEP = 0.05;
/** 최대 피치 배율 */
const MAX_PITCH = 1.5;
/** "ON FIRE" 표시 기준 콤보 */
const ON_FIRE_THRESHOLD = 5;

/** 전역 피드백 트리거 (외부에서 호출) */
let globalTrigger: ((type: 'hit' | 'headshot' | 'miss') => void) | null = null;
/** 전역 콤보 상태 getter (SoundEngine 피치 연동용) */
let globalGetCombo: (() => ComboState) | null = null;

/** 외부에서 사격 피드백을 트리거하는 함수 */
export function triggerShootingFeedback(type: 'hit' | 'miss', hitZone?: HitZone): void {
  const feedbackType: FeedbackType = (type === 'hit' && hitZone === 'head') ? 'headshot' : type;
  globalTrigger?.(feedbackType);
}

/** 현재 콤보 피치 배율 가져오기 (SoundEngine 연동) */
export function getComboState(): ComboState {
  return globalGetCombo?.() ?? { count: 0, lastHitTime: 0, pitchMultiplier: 1.0 };
}

export function ShootingFeedback() {
  const [events, setEvents] = useState<FeedbackEvent[]>([]);
  const [scorePopups, setScorePopups] = useState<ScorePopup[]>([]);
  const [combo, setCombo] = useState<ComboState>({ count: 0, lastHitTime: 0, pitchMultiplier: 1.0 });
  const nextId = useRef(0);
  const comboRef = useRef(combo);
  const comboTimerRef = useRef<number | null>(null);

  // comboRef를 항상 최신 상태로 유지
  useEffect(() => { comboRef.current = combo; }, [combo]);

  /** 콤보 리셋 타이머 설정 */
  const scheduleComboReset = useCallback(() => {
    if (comboTimerRef.current !== null) {
      window.clearTimeout(comboTimerRef.current);
    }
    comboTimerRef.current = window.setTimeout(() => {
      setCombo({ count: 0, lastHitTime: 0, pitchMultiplier: 1.0 });
      comboTimerRef.current = null;
    }, COMBO_TIMEOUT);
  }, []);

  /** 피드백 이벤트 추가 */
  const addFeedback = useCallback((type: FeedbackType) => {
    const now = Date.now();
    const id = nextId.current;
    nextId.current += 2;

    // 머즐 플래시 + 히트/미스 마커 동시에
    setEvents((prev) => [
      ...prev,
      { id, type: 'flash', timestamp: now },
      { id: id + 1, type, timestamp: now },
    ]);

    // 300ms 후 자동 제거
    window.setTimeout(() => {
      setEvents((prev) => prev.filter((e) => e.id !== id && e.id !== id + 1));
    }, 300);

    // 히트/헤드샷일 때: 콤보 업데이트 + 스코어 팝업
    if (type === 'hit' || type === 'headshot') {
      const isHeadshot = type === 'headshot';
      const points = isHeadshot ? 200 : 100;

      // 콤보 업데이트
      setCombo((prev) => {
        const newCount = prev.count + 1;
        const pitchMultiplier = Math.min(MAX_PITCH, 1.0 + (newCount - 1) * COMBO_PITCH_STEP);
        return { count: newCount, lastHitTime: now, pitchMultiplier };
      });
      scheduleComboReset();

      // 스코어 팝업 추가
      const popupId = nextId.current++;
      setScorePopups((prev) => [...prev, { id: popupId, points, isHeadshot, timestamp: now }]);
      window.setTimeout(() => {
        setScorePopups((prev) => prev.filter((p) => p.id !== popupId));
      }, 600);
    } else if (type === 'miss') {
      // 미스 시 콤보 리셋
      setCombo({ count: 0, lastHitTime: 0, pitchMultiplier: 1.0 });
      if (comboTimerRef.current !== null) {
        window.clearTimeout(comboTimerRef.current);
        comboTimerRef.current = null;
      }
    }
  }, [scheduleComboReset]);

  // 전역 트리거 + 콤보 getter 등록
  useEffect(() => {
    globalTrigger = addFeedback;
    globalGetCombo = () => comboRef.current;
    return () => {
      globalTrigger = null;
      globalGetCombo = null;
      if (comboTimerRef.current !== null) window.clearTimeout(comboTimerRef.current);
    };
  }, [addFeedback]);

  return (
    <>
      {/* 사격 피드백 레이어 */}
      {events.length > 0 && (
        <div className="shooting-feedback-overlay">
          {events.map((evt) => {
            if (evt.type === 'flash') {
              return <div key={evt.id} className="muzzle-flash" />;
            }
            if (evt.type === 'hit') {
              return (
                <div key={evt.id} className="hitmarker hitmarker-body">
                  <svg width="32" height="32" viewBox="0 0 32 32">
                    <line x1="6" y1="6" x2="12" y2="12" stroke="white" strokeWidth="2.5" />
                    <line x1="20" y1="6" x2="26" y2="12" stroke="white" strokeWidth="2.5" />
                    <line x1="6" y1="26" x2="12" y2="20" stroke="white" strokeWidth="2.5" />
                    <line x1="20" y1="26" x2="26" y2="20" stroke="white" strokeWidth="2.5" />
                  </svg>
                </div>
              );
            }
            if (evt.type === 'headshot') {
              return (
                <div key={evt.id} className="hitmarker hitmarker-headshot">
                  <svg width="40" height="40" viewBox="0 0 40 40">
                    <line x1="6" y1="6" x2="14" y2="14" stroke="#FF4444" strokeWidth="3" />
                    <line x1="26" y1="6" x2="34" y2="14" stroke="#FF4444" strokeWidth="3" />
                    <line x1="6" y1="34" x2="14" y2="26" stroke="#FF4444" strokeWidth="3" />
                    <line x1="26" y1="34" x2="34" y2="26" stroke="#FF4444" strokeWidth="3" />
                  </svg>
                </div>
              );
            }
            // miss
            return (
              <div key={evt.id} className="miss-marker">
                <svg width="24" height="24" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="rgba(255,100,100,0.7)" strokeWidth="1.5" fill="none" />
                </svg>
              </div>
            );
          })}
        </div>
      )}

      {/* 스코어 팝업 레이어 */}
      {scorePopups.length > 0 && (
        <div className="score-popup-overlay">
          {scorePopups.map((popup) => (
            <div
              key={popup.id}
              className={`score-popup ${popup.isHeadshot ? 'score-popup-headshot' : 'score-popup-body'}`}
            >
              +{popup.points}{popup.isHeadshot && ' HEADSHOT'}
            </div>
          ))}
        </div>
      )}

      {/* 콤보 카운터 */}
      {combo.count >= 2 && (
        <div className="combo-overlay">
          <div className={`combo-counter ${combo.count >= ON_FIRE_THRESHOLD ? 'combo-on-fire' : ''}`}>
            <span className="combo-number">{combo.count}</span>
            <span className="combo-label">COMBO</span>
            {combo.count >= ON_FIRE_THRESHOLD && (
              <span className="combo-fire-text">ON FIRE</span>
            )}
          </div>
        </div>
      )}
    </>
  );
}
