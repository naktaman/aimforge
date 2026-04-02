/**
 * 스타일 전환 모드 화면
 * 4단계 Phase 인디케이터 + 수렴 진행바 + 전환 시작 폼
 */
import { useState, useEffect } from 'react';
import { useTrainingStore } from '../stores/trainingStore';
import { useTranslation } from '../i18n';

interface Props {
  onBack: () => void;
  profileId: number;
}

/** Phase 단계 정의 — i18n 키 기반 */
const PHASES = [
  { key: 'initial', labelKey: 'style.initial', icon: '1' },
  { key: 'adaptation', labelKey: 'style.adaptation', icon: '2' },
  { key: 'consolidation', labelKey: 'style.consolidation', icon: '3' },
  { key: 'mastery', labelKey: 'style.mastery', icon: '4' },
] as const;

/** 스타일 타입 옵션 — i18n 키 기반 */
const STYLE_TYPES = [
  { value: 'wrist-flicker', labelKey: 'style.wristFlicker' },
  { value: 'arm-tracker', labelKey: 'style.armTracker' },
  { value: 'hybrid', labelKey: 'style.hybrid' },
  { value: 'precision', labelKey: 'style.precision' },
] as const;

/** 수렴 퍼센트 기준으로 피처 바 색상 클래스 반환 */
function featureFillClass(pct: number): string {
  if (pct > 80) return 'st-feature-fill st-feature-fill--high';
  if (pct > 50) return 'st-feature-fill st-feature-fill--mid';
  return 'st-feature-fill st-feature-fill--low';
}

export default function StyleTransition({ onBack, profileId }: Props) {
  const { t } = useTranslation();
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
        <button onClick={onBack} className="btn btn--ghost btn--sm">← {t('common.back')}</button>
        <h2>{t('style.title')}</h2>
      </div>

      {styleTransition && transitionProgress ? (
        <>
          {/* 전환 방향 (From → To) 표시 */}
          <div className="glass-card page-section">
            <div className="st-direction">
              <span className="st-direction__from">
                {STYLE_TYPES.find(s => s.value === styleTransition.fromType)
                  ? t(STYLE_TYPES.find(s => s.value === styleTransition.fromType)!.labelKey)
                  : styleTransition.fromType}
              </span>
              <span className="st-direction__arrow">→</span>
              <span className="st-direction__to">
                {STYLE_TYPES.find(s => s.value === styleTransition.toType)
                  ? t(STYLE_TYPES.find(s => s.value === styleTransition.toType)!.labelKey)
                  : styleTransition.toType}
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
                    <div className="st-phase__label">{t(phase.labelKey)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 전체 수렴도 프로그레스 바 */}
          <div className="glass-card page-section">
            <div className="st-progress-header">
              <span className="text-sm">{t('style.overallConvergence')}</span>
              <span className="font-bold" style={{ color: 'var(--info)' }}>
                {transitionProgress.convergencePct.toFixed(1)}%
              </span>
            </div>
            <div className="st-progress-track">
              <div
                className="st-progress-fill"
                style={{ width: `${transitionProgress.convergencePct}%` }}
              />
            </div>

            {transitionProgress.estimatedDaysRemaining > 0 && (
              <div className="st-remaining">
                {t('style.estimatedRemaining')}: ~{Math.ceil(transitionProgress.estimatedDaysRemaining)} {t('style.days')}
              </div>
            )}
          </div>

          {/* 핵심 피처별 수렴 바 */}
          <div className="glass-card page-section">
            <h3 className="page-section__title">{t('style.keyFeatureConvergence')}</h3>
            {transitionProgress.keyFeaturesStatus.map(f => (
              <div key={f.featureName} className="st-feature">
                <div className="st-feature__header">
                  <span>{f.featureName.replace(/_/g, ' ')}</span>
                  <span className="text-muted">
                    {f.convergencePct.toFixed(0)}% ({f.targetDirection === 'up' ? '↑' : '↓'})
                  </span>
                </div>
                <div className="st-feature-track">
                  <div
                    className={featureFillClass(f.convergencePct)}
                    style={{ width: `${f.convergencePct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* 플래토(정체) 경고 메시지 */}
          {transitionProgress.plateauDetected && (
            <div className="st-plateau-warning">
              {t('style.plateauWarning')}
            </div>
          )}

          {/* 전환 완료 버튼 */}
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button onClick={handleComplete} className="btn btn--success btn--sm">
              {t('style.completeTransition')}
            </button>
          </div>
        </>
      ) : (
        /* 새 전환 시작 폼 */
        <div className="glass-card">
          <h3 className="page-section__title">{t('style.newTransition')}</h3>

          <div className="st-form">
            <div className="form-group">
              <label className="form-label">{t('style.currentStyle')}</label>
              <select
                value={fromType}
                onChange={e => setFromType(e.target.value)}
                className="select-field"
              >
                {STYLE_TYPES.map(s => <option key={s.value} value={s.value}>{t(s.labelKey)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('style.targetStyle')}</label>
              <select
                value={toType}
                onChange={e => setToType(e.target.value)}
                className="select-field"
              >
                {STYLE_TYPES.map(s => <option key={s.value} value={s.value}>{t(s.labelKey)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('style.targetSensRange')}</label>
              <input
                type="text"
                value={sensRange}
                onChange={e => setSensRange(e.target.value)}
                placeholder="e.g. 25-35"
                className="input-field"
              />
            </div>
            <button onClick={handleStart} className="btn btn--primary">
              {t('style.startTransition')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
