/**
 * 루틴 빌더 — 시나리오 순서 구성, 스텝 추가/삭제
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

interface RoutineBuilderProps {
  routineId: number;
  routineName: string;
  onBack: () => void;
  onPlay: (routineId: number) => void;
}

export function RoutineBuilder({ routineId, routineName, onBack, onPlay }: RoutineBuilderProps) {
  const { currentSteps, loadSteps, addStep, removeStep } = useRoutineStore();
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

      {/* 스텝 목록 */}
      <div className="step-list">
        {currentSteps.map((step, idx) => (
          <div key={step.id} className="step-card">
            <span className="step-order">{idx + 1}</span>
            <span className="step-name">{step.scenarioType}</span>
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
