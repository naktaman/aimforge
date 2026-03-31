/**
 * 줌 캘리브레이션 진행 화면
 * 비율별 진행 스테퍼 + 페이즈 표시 + GP 차트
 */
import { useZoomCalibrationStore } from '../stores/zoomCalibrationStore';

interface ZoomCalibrationProgressProps {
  onCancel: () => void;
}

/** 페이즈 한글 이름 */
const PHASE_LABELS: Record<string, string> = {
  steady: 'A: 줌 에이밍',
  correction: 'B: 전환 보정',
  zoomout: 'C: 복귀 재획득',
};

/** 페이즈 색상 */
const PHASE_COLORS: Record<string, string> = {
  steady: '#4ade80',
  correction: '#f59e0b',
  zoomout: '#60a5fa',
};

export function ZoomCalibrationProgress({ onCancel }: ZoomCalibrationProgressProps) {
  const {
    currentRatioIndex,
    totalRatios,
    currentPhase,
    ratioStatuses,
  } = useZoomCalibrationStore();

  const currentStatus = ratioStatuses[currentRatioIndex];

  return (
    <div className="zoom-calibration-progress">
      <h2>줌 캘리브레이션 진행 중</h2>

      {/* 비율별 진행 스테퍼 */}
      <div className="ratio-stepper">
        {ratioStatuses.map((status, i) => (
          <div
            key={i}
            className={`step ${status.completed ? 'completed' : i === currentRatioIndex ? 'active' : 'pending'}`}
          >
            <div className="step-icon">
              {status.completed ? '\u2713' : i === currentRatioIndex ? '\u25CB' : '\u2022'}
            </div>
            <div className="step-label">{status.scopeName}</div>
            <div className="step-ratio">{status.zoomRatio}x</div>
            {status.bestScore !== null && (
              <div className="step-score">{status.bestScore.toFixed(2)}</div>
            )}
          </div>
        ))}
      </div>

      {/* 현재 비율 정보 */}
      {currentStatus && (
        <div className="current-ratio-info">
          <h3>
            {currentStatus.scopeName} ({currentStatus.zoomRatio}x)
            <span className="iteration-count"> — {currentStatus.iteration}회</span>
          </h3>

          {/* 페이즈 표시 */}
          <div className="phase-indicator">
            {(['steady', 'correction', 'zoomout'] as const).map((phase) => (
              <span
                key={phase}
                className={`phase-chip ${currentPhase === phase ? 'active' : ''}`}
                style={{
                  borderColor: currentPhase === phase ? PHASE_COLORS[phase] : 'transparent',
                  color: currentPhase === phase ? PHASE_COLORS[phase] : '#666',
                }}
              >
                {PHASE_LABELS[phase]}
              </span>
            ))}
          </div>

          {/* 현재 최적 */}
          {currentStatus.bestMultiplier !== null && (
            <div className="current-best">
              <span className="best-label">현재 최적 배율:</span>
              <span className="best-value">{currentStatus.bestMultiplier.toFixed(3)}</span>
              <span className="best-score">score: {currentStatus.bestScore?.toFixed(3)}</span>
            </div>
          )}
        </div>
      )}

      {/* 전체 진행률 */}
      <div className="overall-progress">
        <div className="progress-bar-container">
          <div
            className="progress-bar-fill"
            style={{ width: `${(currentRatioIndex / totalRatios) * 100}%` }}
          />
        </div>
        <span className="progress-text">
          {currentRatioIndex} / {totalRatios} 비율 완료
        </span>
      </div>

      <button className="btn-secondary" onClick={onCancel}>
        취소
      </button>
    </div>
  );
}
