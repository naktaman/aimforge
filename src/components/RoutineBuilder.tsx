/**
 * 루틴 빌더 — 시나리오 순서 구성, 스텝 추가/삭제/순서 변경 + 시간 배분 시각화
 */
import { useEffect, useState, useCallback } from 'react';
import { useRoutineStore, type RoutineStep } from '../stores/routineStore';
import type { ScenarioType } from '../utils/types';

/** 추가 가능한 시나리오 목록 */
const AVAILABLE_SCENARIOS: { type: ScenarioType; name: string; defaultDuration: number }[] = [
  { type: 'flick', name: 'Static Flick', defaultDuration: 60 },
  { type: 'tracking', name: 'Linear Tracking', defaultDuration: 30 },
  { type: 'circular_tracking', name: 'Circular Tracking', defaultDuration: 30 },
  { type: 'stochastic_tracking', name: 'Stochastic Tracking', defaultDuration: 30 },
  { type: 'counter_strafe_flick', name: 'Counter-Strafe Flick', defaultDuration: 60 },
  { type: 'micro_flick', name: 'Micro Flick', defaultDuration: 30 },
];

/** 시나리오별 색상 */
const SCENARIO_COLORS: Record<string, string> = {
  flick: '#e94560',
  tracking: '#4ade80',
  circular_tracking: '#38bdf8',
  stochastic_tracking: '#c084fc',
  counter_strafe_flick: '#fb923c',
  micro_flick: '#fbbf24',
};

/** 시나리오 한국어 이름 매핑 */
const SCENARIO_LABELS: Record<string, string> = {
  flick: 'Static Flick',
  tracking: 'Linear Tracking',
  circular_tracking: 'Circular Tracking',
  stochastic_tracking: 'Stochastic Tracking',
  counter_strafe_flick: 'Counter-Strafe Flick',
  micro_flick: 'Micro Flick',
};

interface RoutineBuilderProps {
  routineId: number;
  routineName: string;
  onBack: () => void;
  onPlay: (routineId: number) => void;
}

export function RoutineBuilder({ routineId, routineName, onBack, onPlay }: RoutineBuilderProps) {
  const { currentSteps, loadSteps, addStep, removeStep, swapStepOrder } = useRoutineStore();
  const [selectedScenario, setSelectedScenario] = useState<ScenarioType>('flick');
  const [stepDuration, setStepDuration] = useState(60);

  useEffect(() => { loadSteps(routineId); }, [routineId, loadSteps]);

  /** 스텝 추가 */
  const handleAdd = useCallback(async () => {
    const nextOrder = currentSteps.length + 1;
    const config = JSON.stringify({ type: selectedScenario });
    await addStep(routineId, selectedScenario, config, stepDuration, nextOrder);
  }, [routineId, selectedScenario, stepDuration, currentSteps.length, addStep]);

  /** 스텝 삭제 */
  const handleRemove = useCallback(async (step: RoutineStep) => {
    await removeStep(step.id, routineId);
  }, [routineId, removeStep]);

  /** 스텝 위로 이동 */
  const handleMoveUp = useCallback(async (idx: number) => {
    if (idx <= 0) return;
    const stepA = currentSteps[idx];
    const stepB = currentSteps[idx - 1];
    await swapStepOrder(routineId, stepA.id, stepB.id);
  }, [routineId, currentSteps, swapStepOrder]);

  /** 스텝 아래로 이동 */
  const handleMoveDown = useCallback(async (idx: number) => {
    if (idx >= currentSteps.length - 1) return;
    const stepA = currentSteps[idx];
    const stepB = currentSteps[idx + 1];
    await swapStepOrder(routineId, stepA.id, stepB.id);
  }, [routineId, currentSteps, swapStepOrder]);

  /** 총 시간 계산 */
  const totalSec = currentSteps.reduce((sum, s) => sum + s.durationSec, 0);

  return (
    <div className="routine-builder">
      <div className="section-header">
        <h2>루틴: {routineName}</h2>
        <div>
          <button className="btn-primary btn-sm" onClick={() => onPlay(routineId)} disabled={currentSteps.length === 0}>
            실행
          </button>
          <button className="btn-secondary btn-sm" onClick={onBack} style={{ marginLeft: 8 }}>돌아가기</button>
        </div>
      </div>

      <div className="routine-total">
        총 {currentSteps.length}개 스텝 | {Math.floor(totalSec / 60)}분 {totalSec % 60}초
      </div>

      {/* 시간 배분 시각화 바 */}
      {currentSteps.length > 0 && (
        <TimeAllocationBar steps={currentSteps} totalSec={totalSec} />
      )}

      {/* 스텝 목록 */}
      <div className="step-list">
        {currentSteps.map((step, idx) => (
          <div key={step.id} className="step-card" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* 순서 변경 버튼 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button
                className="btn-sm"
                onClick={() => handleMoveUp(idx)}
                disabled={idx === 0}
                style={{ padding: '1px 6px', fontSize: 11, opacity: idx === 0 ? 0.3 : 1 }}
                title="위로 이동"
              >
                ▲
              </button>
              <button
                className="btn-sm"
                onClick={() => handleMoveDown(idx)}
                disabled={idx === currentSteps.length - 1}
                style={{ padding: '1px 6px', fontSize: 11, opacity: idx === currentSteps.length - 1 ? 0.3 : 1 }}
                title="아래로 이동"
              >
                ▼
              </button>
            </div>
            <span className="step-order">{idx + 1}</span>
            <span
              className="step-name"
              style={{ color: SCENARIO_COLORS[step.scenarioType] ?? '#ccc' }}
            >
              {SCENARIO_LABELS[step.scenarioType] ?? step.scenarioType}
            </span>
            <span className="step-duration">{step.durationSec}초</span>
            <button className="btn-sm btn-danger" onClick={() => handleRemove(step)}>삭제</button>
          </div>
        ))}
      </div>

      {/* 스텝 추가 폼 */}
      <div className="step-add-form">
        <select value={selectedScenario} onChange={(e) => {
          const type = e.target.value as ScenarioType;
          setSelectedScenario(type);
          const def = AVAILABLE_SCENARIOS.find(s => s.type === type);
          if (def) setStepDuration(def.defaultDuration);
        }}>
          {AVAILABLE_SCENARIOS.map(s => (
            <option key={s.type} value={s.type}>{s.name}</option>
          ))}
        </select>
        <label>
          시간(초)
          <input
            type="number"
            min={10}
            max={300}
            value={stepDuration}
            onChange={(e) => setStepDuration(parseInt(e.target.value, 10) || 30)}
          />
        </label>
        <button className="btn-primary btn-sm" onClick={handleAdd}>+ 스텝 추가</button>
      </div>
    </div>
  );
}

/** 시간 배분 시각화 — 시나리오별 색상 스택 바 + 범례 */
function TimeAllocationBar({ steps, totalSec }: { steps: RoutineStep[]; totalSec: number }) {
  if (totalSec === 0) return null;

  // 시나리오별 시간 합산
  const timeByType: Record<string, number> = {};
  for (const step of steps) {
    timeByType[step.scenarioType] = (timeByType[step.scenarioType] ?? 0) + step.durationSec;
  }

  const entries = Object.entries(timeByType).sort((a, b) => b[1] - a[1]);

  return (
    <div style={{ marginBottom: 16 }}>
      {/* 스택 바 */}
      <div style={{ display: 'flex', height: 20, borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
        {entries.map(([type, sec]) => {
          const pct = (sec / totalSec) * 100;
          return (
            <div
              key={type}
              style={{
                width: `${pct}%`,
                background: SCENARIO_COLORS[type] ?? '#666',
                minWidth: 2,
              }}
              title={`${SCENARIO_LABELS[type] ?? type}: ${sec}초 (${pct.toFixed(0)}%)`}
            />
          );
        })}
      </div>
      {/* 범례 */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11 }}>
        {entries.map(([type, sec]) => {
          const pct = ((sec / totalSec) * 100).toFixed(0);
          return (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 10, height: 10, borderRadius: 2,
                background: SCENARIO_COLORS[type] ?? '#666',
              }} />
              <span>{SCENARIO_LABELS[type] ?? type}</span>
              <span style={{ opacity: 0.6 }}>{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
