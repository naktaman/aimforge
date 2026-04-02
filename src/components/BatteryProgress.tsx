/**
 * 배터리 진행 화면
 * 시나리오 큐 표시, 카운트다운, 자동 진행 관리
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { CountdownTransition } from './transitions';
import { useBatteryStore } from '../stores/batteryStore';
import type { ScenarioType } from '../utils/types';

/** 시나리오 타입 → 한글 이름 */
const SCENARIO_LABELS: Record<string, string> = {
  flick: 'Flick',
  tracking: 'Tracking',
  circular_tracking: 'Circular Tracking',
  stochastic_tracking: 'Stochastic Tracking',
  counter_strafe_flick: 'Counter-Strafe Flick',
  micro_flick: 'Micro-Flick',
  zoom_composite: 'Zoom Composite',
};

/** 배터리에서 실행할 시나리오 순서 */
const SCENARIO_ORDER: ScenarioType[] = [
  'flick', 'tracking', 'circular_tracking', 'stochastic_tracking',
  'counter_strafe_flick', 'micro_flick', 'zoom_composite',
];

interface Props {
  /** 시나리오 실행 요청 */
  onLaunchScenario: (type: ScenarioType) => void;
  /** 배터리 취소 */
  onCancel: () => void;
  /** 배터리 완료 시 결과 화면 이동 */
  onComplete: () => void;
}

export function BatteryProgress({ onLaunchScenario, onCancel, onComplete }: Props) {
  const { battery, preset, completedScores, currentScenarioType } = useBatteryStore();
  const [countdown, setCountdown] = useState<number | null>(null);
  const hasLaunched = useRef(false);

  // 배터리 인스턴스에서 진행 정보 가져오기
  const progress = battery?.getProgressInfo() ?? { current: 0, total: 7 };
  const progressPct = battery?.getProgress() ?? 0;

  // 시나리오 큐 상태 구성
  const scenarioStates = SCENARIO_ORDER.map((type) => {
    const score = completedScores[type];
    const isCurrent = type === currentScenarioType;
    const isCompleted = score !== undefined;
    return { type, score, isCurrent, isCompleted };
  });

  /** 카운트다운 후 시나리오 실행 */
  const startCountdown = useCallback(() => {
    if (!currentScenarioType || hasLaunched.current) return;
    hasLaunched.current = true;
    setCountdown(3);
  }, [currentScenarioType]);

  // 카운트다운 타이머
  useEffect(() => {
    if (countdown === null) return;

    if (countdown <= 0) {
      // 카운트다운 완료 → 시나리오 실행
      if (currentScenarioType) {
        onLaunchScenario(currentScenarioType);
      }
      setCountdown(null);
      return;
    }

    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, currentScenarioType, onLaunchScenario]);

  // 현재 시나리오가 바뀌면 카운트다운 시작
  useEffect(() => {
    if (currentScenarioType && !hasLaunched.current) {
      // 약간 딜레이 후 카운트다운 시작
      const delay = setTimeout(() => startCountdown(), 500);
      return () => clearTimeout(delay);
    }
  }, [currentScenarioType, startCountdown]);

  // 모든 시나리오 완료 감지
  useEffect(() => {
    if (battery?.isComplete()) {
      onComplete();
    }
  }, [battery, completedScores, onComplete]);

  // 시나리오 완료 후 복귀 시 다음 시나리오 준비
  useEffect(() => {
    hasLaunched.current = false;
  }, [currentScenarioType]);

  return (
    <main className="app-main">
      <div className="battery-progress">
        <h2>Battery Test — {preset}</h2>

        {/* 진행률 바 */}
        <div className="progress-bar-container">
          <div className="progress-bar" style={{ width: `${progressPct * 100}%` }} />
          <span className="progress-label">{progress.current} / {progress.total}</span>
        </div>

        {/* 카운트다운 오버레이 (scale + fade 애니메이션) */}
        {countdown !== null && countdown > 0 && (
          <div className="countdown-overlay">
            <div className="countdown-text">
              {SCENARIO_LABELS[currentScenarioType ?? ''] ?? '다음 시나리오'}
            </div>
            <CountdownTransition count={countdown} />
          </div>
        )}

        {/* 시나리오 체크리스트 */}
        <div className="scenario-checklist">
          {scenarioStates.map(({ type, score, isCurrent, isCompleted }) => (
            <div
              key={type}
              className={`scenario-item ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}
            >
              <span className="scenario-status">
                {isCompleted ? '✓' : isCurrent ? '▶' : '○'}
              </span>
              <span className="scenario-name">{SCENARIO_LABELS[type] ?? type}</span>
              {isCompleted && (
                <span className="scenario-score">{score?.toFixed(1)}</span>
              )}
            </div>
          ))}
        </div>

        {/* 액션 버튼 */}
        <div className="battery-actions">
          <button className="btn-secondary" onClick={onCancel}>
            취소
          </button>
        </div>
      </div>
    </main>
  );
}
