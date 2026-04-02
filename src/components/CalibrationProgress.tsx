/**
 * 캘리브레이션 진행 화면
 * 스크리닝/캘리브레이션 진행도 + GP 곡선 시각화
 */
import { useCalibrationStore } from '../stores/calibrationStore';
import { useTranslation } from '../i18n';
import { PerformanceLandscape } from './PerformanceLandscape';

interface CalibrationProgressProps {
  onCancel: () => void;
}

export function CalibrationProgress({ onCancel }: CalibrationProgressProps) {
  const {
    stage,
    mode,
    convergenceLevel,
    iteration,
    maxIterations,
    screeningProgress,
    currentBest,
    gpCurve,
    observations,
    fatigueStopped,
  } = useCalibrationStore();
  const { t } = useTranslation();

  /** 스테이지 라벨 */
  const stageLabel = stage === 'screening' ? t('cal.screening') : t('cal.sensSearch');

  /** 진행률 계산 */
  const progress = stage === 'screening' && screeningProgress
    ? (screeningProgress.current / screeningProgress.target) * 100
    : (iteration / maxIterations) * 100;

  return (
    <div className="calibration-progress">
      <h2>{t('cal.inProgress')}</h2>

      {/* 스테이지 뱃지 */}
      <div className="stage-badge">
        <span className={`badge ${stage}`}>
          {stage === 'screening' ? 'Stage 1' : 'Stage 2'}: {stageLabel}
        </span>
        <span className="mode-badge">{mode.toUpperCase()}</span>
      </div>

      {/* 진행 바 */}
      <div className="progress-section">
        <div className="progress-bar-container">
          <div
            className="progress-bar-fill"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <div className="progress-label">
          {stage === 'screening' && screeningProgress
            ? `${screeningProgress.current} / ${screeningProgress.target} ${t('cal.trials')}`
            : `${iteration} / ${maxIterations} ${t('cal.iterations')}`}
        </div>
      </div>

      {/* 현재 최적 */}
      {currentBest && (
        <div className="current-best">
          <h3>{t('cal.currentBest')}</h3>
          <div className="best-value">
            <span className="big-number">{currentBest.cm360.toFixed(1)}</span>
            <span className="unit">cm/360</span>
          </div>
          <div className="best-score">
            score: {currentBest.score.toFixed(3)}
          </div>
        </div>
      )}

      {/* Performance Landscape (D3) */}
      {gpCurve.length > 0 && (
        <div className="gp-chart-container">
          <h3>Performance Landscape</h3>
          <PerformanceLandscape
            gpCurve={gpCurve}
            observations={observations}
            convergenceMode={convergenceLevel}
          />
        </div>
      )}

      {/* 피로 경고 */}
      {fatigueStopped && (
        <div className="fatigue-warning">
          {t('cal.fatigueWarning')}
        </div>
      )}

      {/* 안내 메시지 */}
      <div className="progress-hint">
        {stage === 'screening' ? t('cal.screeningHint') : t('cal.calHint')}
      </div>

      <button className="btn-secondary" onClick={onCancel}>
        {t('common.cancel')}
      </button>
    </div>
  );
}

