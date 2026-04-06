/**
 * 줌 캘리브레이션 진행 화면
 * 비율별 진행 스테퍼 + 페이즈 표시 + GP 차트
 */
import { useZoomCalibrationStore } from '../stores/zoomCalibrationStore';
import { useTranslation } from '../i18n';
import { UI_COLORS } from '../config/theme';

interface ZoomCalibrationProgressProps {
  onCancel: () => void;
  onLaunchTrial: () => void;
}

/** 페이즈 i18n 키 */
const PHASE_LABEL_KEYS: Record<string, string> = {
  steady: 'zoom.phaseA',
  correction: 'zoom.phaseB',
  zoomout: 'zoom.phaseC',
};

/** 페이즈 색상 — 테마 토큰 사용 */
const PHASE_COLORS: Record<string, string> = {
  steady: UI_COLORS.successGreen,
  correction: UI_COLORS.phaseAmber, /* 교정 단계 앰버 토큰 */
  zoomout: UI_COLORS.infoBlue,
};

export function ZoomCalibrationProgress({ onCancel, onLaunchTrial }: ZoomCalibrationProgressProps) {
  const {
    currentRatioIndex,
    totalRatios,
    currentPhase,
    ratioStatuses,
  } = useZoomCalibrationStore();
  const { t } = useTranslation();

  const currentStatus = ratioStatuses[currentRatioIndex];

  return (
    <div className="zoom-calibration-progress">
      <h2>{t('zoom.inProgress')}</h2>

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
                  color: currentPhase === phase ? PHASE_COLORS[phase] : UI_COLORS.chartTickText, /* 비활성 틱 텍스트 토큰 */
                }}
              >
                {t(PHASE_LABEL_KEYS[phase])}
              </span>
            ))}
          </div>

          {/* 현재 최적 */}
          {currentStatus.bestMultiplier !== null && (
            <div className="current-best">
              <span className="best-label">{t('zoom.currentBestMultiplier')}</span>
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
          {currentRatioIndex} / {totalRatios} {t('zoom.ratiosComplete')}
        </span>
      </div>

      {/* 트라이얼 시작 버튼 */}
      <button className="btn-primary" onClick={onLaunchTrial}>
        {t('zoom.launchTrial')}
      </button>

      <button className="btn-secondary" onClick={onCancel}>
        {t('common.cancel')}
      </button>
    </div>
  );
}
