/**
 * 스타일 전환 모드 화면
 * 4단계 Phase 인디케이터 + 수렴 진행바 + 전환 시작 폼
 */
import { useState, useEffect } from 'react';
import { useTrainingStore } from '../stores/trainingStore';

interface Props {
  onBack: () => void;
  profileId: number;
}

/** Phase 단계 정의 */
const PHASES = [
  { key: 'initial', label: '초기', icon: '1' },
  { key: 'adaptation', label: '적응', icon: '2' },
  { key: 'consolidation', label: '안정화', icon: '3' },
  { key: 'mastery', label: '숙달', icon: '4' },
] as const;

/** 스타일 타입 옵션 */
const STYLE_TYPES = [
  { value: 'wrist-flicker', label: '손목 플리커' },
  { value: 'arm-tracker', label: '팔 트래커' },
  { value: 'hybrid', label: '하이브리드' },
  { value: 'precision', label: '정밀 사수' },
] as const;

/** 수렴 퍼센트 기준으로 피처 바 색상 클래스 반환 */
function featureFillClass(pct: number): string {
  if (pct > 80) return 'st-feature-fill st-feature-fill--high';
  if (pct > 50) return 'st-feature-fill st-feature-fill--mid';
  return 'st-feature-fill st-feature-fill--low';
}

export default function StyleTransition({ onBack, profileId }: Props) {
  const {
    styleTransition, transitionProgress,
    loadStyleTransition, startStyleTransition, updateStyleTransition,
  } = useTrainingStore();

  const [fromType, setFromType] = useState('wrist-flicker');
  const [toType, setToType] = useState('arm-tracker');
  const [sensRange, setSensRange] = useState('25-35');

  /** 컴포넌트 마운트 시 기존 전환 데이터 로드 */
  useEffect(() => {
    loadStyleTransition(profileId);
  }, [profileId, loadStyleTransition]);

  /** 새 스타일 전환 시작 핸들러 */
  const handleStart = () => {
    startStyleTransition(profileId, fromType, toType, sensRange);
  };

  /** 전환 완료 처리 핸들러 */
  const handleComplete = () => {
    updateStyleTransition(profileId, 'complete');
  };

  /** 현재 Phase 인덱스 (-1이면 아직 전환 없음) */
  const currentPhaseIdx = transitionProgress
    ? PHASES.findIndex(p => p.key === transitionProgress.phase)
    : -1;

  return (
    <div className="page page--narrow">
      {/* 헤더 */}
      <div className="page-header">
        <button onClick={onBack} className="btn btn--ghost btn--sm">← 뒤로</button>
        <h2>스타일 전환</h2>
      </div>

      {styleTransition && transitionProgress ? (
        <>
          {/* 전환 방향 (From → To) 표시 */}
          <div className="glass-card page-section">
            <div className="st-direction">
              <span className="st-direction__from">
                {STYLE_TYPES.find(s => s.value === styleTransition.from_type)?.label || styleTransition.from_type}
              </span>
              <span className="st-direction__arrow">→</span>
              <span className="st-direction__to">
                {STYLE_TYPES.find(s => s.value === styleTransition.to_type)?.label || styleTransition.to_type}
              </span>
            </div>
          </div>

          {/* Phase 인디케이터: 4단계 원형 아이콘 */}
          <div className="glass-card page-section">
            <div className="st-phases">
              {PHASES.map((phase, i) => {
                const isActive = i === currentPhaseIdx;
                const isDone = i < currentPhaseIdx;
                const stateClass = isDone ? 'st-phase--done' : isActive ? 'st-phase--active' : '';
                return (
                  <div key={phase.key} className={`st-phase ${stateClass}`}>
                    <div className="st-phase__circle">
                      {isDone ? '✓' : phase.icon}
                    </div>
                    <div className="st-phase__label">{phase.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 전체 수렴도 프로그레스 바 */}
          <div className="glass-card page-section">
            <div className="st-progress-header">
              <span className="text-sm">전체 수렴도</span>
              <span className="font-bold" style={{ color: 'var(--info)' }}>
                {transitionProgress.convergence_pct.toFixed(1)}%
              </span>
            </div>
            <div className="st-progress-track">
              <div
                className="st-progress-fill"
                style={{ width: `${transitionProgress.convergence_pct}%` }}
              />
            </div>

            {transitionProgress.estimated_days_remaining > 0 && (
              <div className="st-remaining">
                예상 잔여: ~{Math.ceil(transitionProgress.estimated_days_remaining)}일
              </div>
            )}
          </div>

          {/* 핵심 피처별 수렴 바 */}
          <div className="glass-card page-section">
            <h3 className="page-section__title">핵심 피처 수렴</h3>
            {transitionProgress.key_features_status.map(f => (
              <div key={f.feature_name} className="st-feature">
                <div className="st-feature__header">
                  <span>{f.feature_name.replace(/_/g, ' ')}</span>
                  <span className="text-muted">
                    {f.convergence_pct.toFixed(0)}% ({f.target_direction === 'up' ? '↑' : '↓'})
                  </span>
                </div>
                <div className="st-feature-track">
                  <div
                    className={featureFillClass(f.convergence_pct)}
                    style={{ width: `${f.convergence_pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* 플래토(정체) 경고 메시지 */}
          {transitionProgress.plateau_detected && (
            <div className="st-plateau-warning">
              플래토 감지: 수렴 속도가 정체되고 있습니다. 훈련 방법 변경을 고려하세요.
            </div>
          )}

          {/* 전환 완료 버튼 */}
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button onClick={handleComplete} className="btn btn--success btn--sm">
              전환 완료
            </button>
          </div>
        </>
      ) : (
        /* 새 전환 시작 폼 */
        <div className="glass-card">
          <h3 className="page-section__title">새 스타일 전환 시작</h3>

          <div className="st-form">
            <div className="form-group">
              <label className="form-label">현재 스타일 (From)</label>
              <select
                value={fromType}
                onChange={e => setFromType(e.target.value)}
                className="select-field"
              >
                {STYLE_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">목표 스타일 (To)</label>
              <select
                value={toType}
                onChange={e => setToType(e.target.value)}
                className="select-field"
              >
                {STYLE_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">목표 감도 범위 (cm/360)</label>
              <input
                type="text"
                value={sensRange}
                onChange={e => setSensRange(e.target.value)}
                placeholder="예: 25-35"
                className="input-field"
              />
            </div>
            <button onClick={handleStart} className="btn btn--primary">
              전환 시작
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
