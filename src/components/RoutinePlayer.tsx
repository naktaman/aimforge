/**
 * 루틴 플레이어 — 루틴 스텝을 순서대로 자동 진행
 * 각 스텝의 durationSec이 지나면 다음 스텝으로 전환
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRoutineStore, type RoutineStep } from '../stores/routineStore';

interface RoutinePlayerProps {
  routineId: number;
  onComplete: () => void;
  onCancel: () => void;
}

export function RoutinePlayer({ routineId, onComplete, onCancel }: RoutinePlayerProps) {
  const { currentSteps, loadSteps } = useRoutineStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => { loadSteps(routineId); }, [routineId, loadSteps]);

  /** 타이머 구동 */
  useEffect(() => {
    if (paused || currentSteps.length === 0) return;

    timerRef.current = setInterval(() => {
      setElapsed(prev => {
        const step = currentSteps[currentIndex];
        if (!step) return prev;
        const next = prev + 1;
        if (next >= step.durationSec) {
          // 다음 스텝으로 이동
          if (currentIndex + 1 >= currentSteps.length) {
            clearInterval(timerRef.current);
            onComplete();
            return 0;
          }
          setCurrentIndex(i => i + 1);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [currentIndex, paused, currentSteps, onComplete]);

  /** 현재 스텝 */
  const step: RoutineStep | undefined = currentSteps[currentIndex];
  const totalSteps = currentSteps.length;
  const progress = step ? (elapsed / step.durationSec) * 100 : 0;

  /** 일시정지/재개 */
  const togglePause = useCallback(() => setPaused(p => !p), []);

  /** 스텝 건너뛰기 */
  const skipStep = useCallback(() => {
    if (currentIndex + 1 >= totalSteps) {
      onComplete();
    } else {
      setCurrentIndex(i => i + 1);
      setElapsed(0);
    }
  }, [currentIndex, totalSteps, onComplete]);

  if (!step) return <p>루틴 로딩 중...</p>;

  return (
    <div className="routine-player">
      <h2>루틴 실행 중</h2>
      <div className="player-status">
        <span>스텝 {currentIndex + 1} / {totalSteps}</span>
        <span className="scenario-name">{step.scenarioType}</span>
      </div>

      {/* 진행 바 */}
      <div className="player-progress-bar">
        <div className="player-progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="player-time">
        {elapsed}초 / {step.durationSec}초
      </div>

      <div className="player-controls">
        <button className="btn-secondary" onClick={togglePause}>
          {paused ? '재개' : '일시정지'}
        </button>
        <button className="btn-secondary" onClick={skipStep}>건너뛰기</button>
        <button className="btn-danger" onClick={onCancel}>중지</button>
      </div>
    </div>
  );
}
