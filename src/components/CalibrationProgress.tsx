/**
 * 캘리브레이션 진행 화면
 * 스크리닝/캘리브레이션 진행도 + GP 곡선 시각화
 */
import { useCalibrationStore } from '../stores/calibrationStore';
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

  /** 스테이지 한글 표시 */
  const stageLabel = stage === 'screening' ? 'DNA 스크리닝' : '감도 탐색';

  /** 진행률 계산 */
  const progress = stage === 'screening' && screeningProgress
    ? (screeningProgress.current / screeningProgress.target) * 100
    : (iteration / maxIterations) * 100;

  return (
    <div className="calibration-progress">
      <h2>캘리브레이션 진행 중</h2>

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
            ? `${screeningProgress.current} / ${screeningProgress.target} 트라이얼`
            : `${iteration} / ${maxIterations} 반복`}
        </div>
      </div>

      {/* 현재 최적 */}
      {currentBest && (
        <div className="current-best">
          <h3>현재 최적</h3>
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
          피로 감지됨 — 휴식을 권장합니다
        </div>
      )}

      {/* 안내 메시지 */}
      <div className="progress-hint">
        {stage === 'screening'
          ? '현재 감도로 시나리오를 수행하세요. 자동으로 다음 단계로 넘어갑니다.'
          : 'AI가 제안하는 감도로 시나리오를 수행하세요. 수렴 시 자동 종료됩니다.'}
      </div>

      <button className="btn-secondary" onClick={onCancel}>
        취소
      </button>
    </div>
  );
}

