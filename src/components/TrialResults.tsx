/**
 * 트라이얼 결과 표시 컴포넌트
 * Flick: 각도별/방향별/운동체계별 브레이크다운
 * Tracking: MAD/phase_lag/velocity_match
 * MicroFlick: 트래킹+플릭+재획득 하이브리드
 * Zoom: 3-Phase 결과 (Steady/Correction/Reacquisition)
 */
import { useSessionStore } from '../stores/sessionStore';
import { RAD2DEG } from '../utils/physics';
import { useTranslation } from '../i18n';

interface TrialResultsProps {
  onBack: () => void;
}

export function TrialResults({ onBack }: TrialResultsProps) {
  const {
    lastFlickResult, lastTrackingResult,
    lastMicroFlickResult, lastZoomResult,
    scenarioType,
  } = useSessionStore();
  const { t } = useTranslation();

  /** Flick 계열 시나리오 (flick, counter_strafe_flick) */
  const isFlickType =
    scenarioType === 'flick' || scenarioType === 'counter_strafe_flick';

  /** Tracking 계열 시나리오 */
  const isTrackingType =
    scenarioType === 'tracking' ||
    scenarioType === 'circular_tracking' ||
    scenarioType === 'stochastic_tracking';

  return (
    <div className="trial-results">
      <h2>{t('result.scenarioResult')}</h2>

      {isFlickType && lastFlickResult && (
        <FlickResults data={lastFlickResult} />
      )}

      {isTrackingType && lastTrackingResult && (
        <TrackingResults data={lastTrackingResult} />
      )}

      {scenarioType === 'micro_flick' && lastMicroFlickResult && (
        <MicroFlickResults data={lastMicroFlickResult} />
      )}

      {scenarioType === 'zoom_composite' && lastZoomResult && (
        <ZoomResults data={lastZoomResult} />
      )}

      <button className="back-button" onClick={onBack}>
        {t('common.back')}
      </button>
    </div>
  );
}

function FlickResults({ data }: { data: NonNullable<ReturnType<typeof useSessionStore.getState>['lastFlickResult']> }) {
  const { overall, byAngle, byDirection, byMotor } = data;
  const { t } = useTranslation();

  return (
    <>
      {/* 종합 */}
      <section className="result-section">
        <h3>{t('result.overall')}</h3>
        <div className="metrics-grid">
          <MetricCard label={t('result.hitRate')} value={overall.hit ? t('trial.hit') : t('trial.miss')} />
          <MetricCard label={t('result.avgTtt')} value={`${overall.ttt.toFixed(0)}ms`} />
          <MetricCard label={t('result.avgOvershoot')} value={`${(overall.overshoot * RAD2DEG).toFixed(1)}°`} />
          <MetricCard label={t('result.correctionCount')} value={overall.correctionCount.toFixed(1)} />
          <MetricCard label={t('result.pathEfficiency')} value={`${(overall.pathEfficiency * 100).toFixed(0)}%`} />
        </div>
      </section>

      {/* 각도별 */}
      <section className="result-section">
        <h3>{t('result.byAngle')}</h3>
        <div className="breakdown-table">
          {Object.entries(byAngle).map(([angle, metrics]) => (
            <div key={angle} className="breakdown-row">
              <span className="label">{angle}°</span>
              <span>TTT: {metrics.ttt.toFixed(0)}ms</span>
              <span>{t('result.hitRate')}: {metrics.hit ? 'O' : 'X'}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 방향별 */}
      <section className="result-section">
        <h3>{t('result.byDirection')}</h3>
        <div className="breakdown-table">
          {Object.entries(byDirection).map(([dir, metrics]) => (
            <div key={dir} className="breakdown-row">
              <span className="label">{dir}</span>
              <span>TTT: {metrics.ttt.toFixed(0)}ms</span>
              <span>{t('result.avgOvershoot')}: {(metrics.overshoot * RAD2DEG).toFixed(1)}°</span>
            </div>
          ))}
        </div>
      </section>

      {/* 운동체계별 */}
      <section className="result-section">
        <h3>{t('result.byMotor')}</h3>
        <div className="breakdown-table">
          {Object.entries(byMotor).map(([motor, metrics]) => (
            <div key={motor} className="breakdown-row">
              <span className="label">{motor}</span>
              <span>TTT: {metrics.ttt.toFixed(0)}ms</span>
              <span>{t('result.pathEfficiency')}: {(metrics.pathEfficiency * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function TrackingResults({ data }: { data: NonNullable<ReturnType<typeof useSessionStore.getState>['lastTrackingResult']> }) {
  const { t } = useTranslation();
  return (
    <section className="result-section">
      <h3>Tracking</h3>
      <div className="metrics-grid">
        <MetricCard label="MAD" value={`${(data.mad * RAD2DEG).toFixed(2)}°`} />
        <MetricCard label={t('result.deviationVariance')} value={`${(data.deviationVariance * RAD2DEG * RAD2DEG).toFixed(3)}`} />
        <MetricCard label={t('result.phaseLag')} value={`${data.phaseLag.toFixed(0)}ms`} />
        <MetricCard label={t('result.velocityMatch')} value={`${(data.velocityMatchRatio * 100).toFixed(0)}%`} />
        <MetricCard label={t('result.trajectoryType')} value={data.trajectoryType} />
      </div>
    </section>
  );
}

/** MicroFlick 하이브리드 결과 */
function MicroFlickResults({ data }: { data: NonNullable<ReturnType<typeof useSessionStore.getState>['lastMicroFlickResult']> }) {
  const { t } = useTranslation();
  return (
    <section className="result-section">
      <h3>Micro-Flick</h3>
      <div className="metrics-grid">
        <MetricCard label={t('result.trackingMad')} value={`${(data.trackingMad * RAD2DEG).toFixed(2)}°`} />
        <MetricCard label={t('result.velocityMatch')} value={`${(data.trackingVelocityMatch * 100).toFixed(0)}%`} />
        <MetricCard label={t('result.flickHitRate')} value={`${(data.flickHitRate * 100).toFixed(0)}%`} />
        <MetricCard label={t('result.avgTtt')} value={`${data.flickAvgTtt.toFixed(0)}ms`} />
        <MetricCard label={t('result.reacquireTime')} value={`${data.avgReacquireTimeMs.toFixed(0)}ms`} />
        <MetricCard label={t('result.compositeScore')} value={data.compositeScore.toFixed(1)} />
      </div>
    </section>
  );
}

/** Zoom 3-Phase 결과 */
function ZoomResults({ data }: { data: NonNullable<ReturnType<typeof useSessionStore.getState>['lastZoomResult']> }) {
  const { t } = useTranslation();
  return (
    <section className="result-section">
      <h3>Zoom 3-Phase ({data.zoomTier})</h3>
      <div className="metrics-grid">
        <MetricCard label="Phase A (Steady)" value={data.steadyScore.toFixed(1)} />
        <MetricCard label="Phase B (Correction)" value={data.correctionScore.toFixed(1)} />
        <MetricCard label="Phase C (Reacquisition)" value={data.reacquisitionScore.toFixed(1)} />
        <MetricCard label={t('result.compositeScore')} value={data.compositeScore.toFixed(1)} />
        <MetricCard label={t('result.overCorrection')} value={`${(data.overCorrectionRatio * 100).toFixed(0)}%`} />
        <MetricCard label={t('result.underCorrection')} value={`${(data.underCorrectionRatio * 100).toFixed(0)}%`} />
      </div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  );
}
