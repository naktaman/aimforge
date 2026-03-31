/**
 * 트라이얼 결과 표시 컴포넌트
 * Flick: 각도별/방향별/운동체계별 브레이크다운
 * Tracking: MAD/phase_lag/velocity_match
 * MicroFlick: 트래킹+플릭+재획득 하이브리드
 * Zoom: 3-Phase 결과 (Steady/Correction/Reacquisition)
 */
import { useSessionStore } from '../stores/sessionStore';
import { RAD2DEG } from '../utils/physics';

interface TrialResultsProps {
  onBack: () => void;
}

export function TrialResults({ onBack }: TrialResultsProps) {
  const {
    lastFlickResult, lastTrackingResult,
    lastMicroFlickResult, lastZoomResult,
    scenarioType,
  } = useSessionStore();

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
      <h2>시나리오 결과</h2>

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
        돌아가기
      </button>
    </div>
  );
}

function FlickResults({ data }: { data: NonNullable<ReturnType<typeof useSessionStore.getState>['lastFlickResult']> }) {
  const { overall, byAngle, byDirection, byMotor } = data;

  return (
    <>
      {/* 종합 */}
      <section className="result-section">
        <h3>종합</h3>
        <div className="metrics-grid">
          <MetricCard label="히트율" value={overall.hit ? '히트' : '미스'} />
          <MetricCard label="평균 TTT" value={`${overall.ttt.toFixed(0)}ms`} />
          <MetricCard label="평균 오버슛" value={`${(overall.overshoot * RAD2DEG).toFixed(1)}°`} />
          <MetricCard label="보정 횟수" value={overall.correctionCount.toFixed(1)} />
          <MetricCard label="경로 효율" value={`${(overall.pathEfficiency * 100).toFixed(0)}%`} />
        </div>
      </section>

      {/* 각도별 */}
      <section className="result-section">
        <h3>각도별</h3>
        <div className="breakdown-table">
          {Object.entries(byAngle).map(([angle, metrics]) => (
            <div key={angle} className="breakdown-row">
              <span className="label">{angle}°</span>
              <span>TTT: {metrics.ttt.toFixed(0)}ms</span>
              <span>히트: {metrics.hit ? 'O' : 'X'}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 방향별 */}
      <section className="result-section">
        <h3>방향별</h3>
        <div className="breakdown-table">
          {Object.entries(byDirection).map(([dir, metrics]) => (
            <div key={dir} className="breakdown-row">
              <span className="label">{dir}</span>
              <span>TTT: {metrics.ttt.toFixed(0)}ms</span>
              <span>오버슛: {(metrics.overshoot * RAD2DEG).toFixed(1)}°</span>
            </div>
          ))}
        </div>
      </section>

      {/* 운동체계별 */}
      <section className="result-section">
        <h3>운동체계별</h3>
        <div className="breakdown-table">
          {Object.entries(byMotor).map(([motor, metrics]) => (
            <div key={motor} className="breakdown-row">
              <span className="label">{motor}</span>
              <span>TTT: {metrics.ttt.toFixed(0)}ms</span>
              <span>경로효율: {(metrics.pathEfficiency * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function TrackingResults({ data }: { data: NonNullable<ReturnType<typeof useSessionStore.getState>['lastTrackingResult']> }) {
  return (
    <section className="result-section">
      <h3>Tracking 메트릭</h3>
      <div className="metrics-grid">
        <MetricCard label="MAD" value={`${(data.mad * RAD2DEG).toFixed(2)}°`} />
        <MetricCard label="편차 분산" value={`${(data.deviationVariance * RAD2DEG * RAD2DEG).toFixed(3)}`} />
        <MetricCard label="Phase Lag" value={`${data.phaseLag.toFixed(0)}ms`} />
        <MetricCard label="속도 매칭" value={`${(data.velocityMatchRatio * 100).toFixed(0)}%`} />
        <MetricCard label="궤적 타입" value={data.trajectoryType} />
      </div>
    </section>
  );
}

/** MicroFlick 하이브리드 결과 */
function MicroFlickResults({ data }: { data: NonNullable<ReturnType<typeof useSessionStore.getState>['lastMicroFlickResult']> }) {
  return (
    <section className="result-section">
      <h3>Micro-Flick 메트릭</h3>
      <div className="metrics-grid">
        <MetricCard label="트래킹 MAD" value={`${(data.trackingMad * RAD2DEG).toFixed(2)}°`} />
        <MetricCard label="속도 매칭" value={`${(data.trackingVelocityMatch * 100).toFixed(0)}%`} />
        <MetricCard label="플릭 히트율" value={`${(data.flickHitRate * 100).toFixed(0)}%`} />
        <MetricCard label="평균 TTT" value={`${data.flickAvgTtt.toFixed(0)}ms`} />
        <MetricCard label="재획득 시간" value={`${data.avgReacquireTimeMs.toFixed(0)}ms`} />
        <MetricCard label="복합 점수" value={data.compositeScore.toFixed(1)} />
      </div>
    </section>
  );
}

/** Zoom 3-Phase 결과 */
function ZoomResults({ data }: { data: NonNullable<ReturnType<typeof useSessionStore.getState>['lastZoomResult']> }) {
  return (
    <section className="result-section">
      <h3>Zoom 3-Phase 메트릭 ({data.zoomTier})</h3>
      <div className="metrics-grid">
        <MetricCard label="Phase A (Steady)" value={data.steadyScore.toFixed(1)} />
        <MetricCard label="Phase B (Correction)" value={data.correctionScore.toFixed(1)} />
        <MetricCard label="Phase C (Reacquisition)" value={data.reacquisitionScore.toFixed(1)} />
        <MetricCard label="복합 점수" value={data.compositeScore.toFixed(1)} />
        <MetricCard label="과보정 비율" value={`${(data.overCorrectionRatio * 100).toFixed(0)}%`} />
        <MetricCard label="과소보정 비율" value={`${(data.underCorrectionRatio * 100).toFixed(0)}%`} />
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
