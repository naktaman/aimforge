/**
 * 캘리브레이션 결과 화면
 * 추천 감도, 유의성, 이봉 감지, DNA 요약
 */
import { useCalibrationStore } from '../stores/calibrationStore';

interface CalibrationResultProps {
  onBack: () => void;
  onApply: (cm360: number) => void;
}

/** 유의성 라벨 한글 매핑 */
const SIGNIFICANCE_LABELS = {
  Recommend: { text: '변경 추천', color: '#4ade80', desc: '유의미한 개선이 예상됩니다' },
  Marginal: { text: '약간 개선', color: '#facc15', desc: '약간 나을 수 있지만 큰 차이 없습니다' },
  Keep: { text: '현재 유지', color: '#60a5fa', desc: '현재 감도가 이미 최적 근처입니다' },
};

export function CalibrationResult({ onBack, onApply }: CalibrationResultProps) {
  const { result } = useCalibrationStore();

  if (!result) {
    return (
      <div className="calibration-result">
        <p>결과 데이터가 없습니다</p>
        <button className="btn-secondary" onClick={onBack}>뒤로</button>
      </div>
    );
  }

  const sig = SIGNIFICANCE_LABELS[result.significance.label];
  const delta = result.recommended_cm360 - result.current_cm360;

  return (
    <div className="calibration-result">
      <h2>캘리브레이션 결과</h2>

      {/* 추천 감도 */}
      <div className="result-recommendation">
        <div className="result-card primary">
          <span className="card-label">추천 감도</span>
          <span className="big-number">{result.recommended_cm360.toFixed(1)}</span>
          <span className="unit">cm/360</span>
        </div>
        <div className="result-card secondary">
          <span className="card-label">현재 감도</span>
          <span className="medium-number">{result.current_cm360.toFixed(1)}</span>
          <span className="unit">cm/360</span>
        </div>
        <div className="result-card delta">
          <span className="card-label">변화량</span>
          <span className="medium-number">
            {delta > 0 ? '+' : ''}{delta.toFixed(1)}
          </span>
          <span className="unit">cm/360</span>
        </div>
      </div>

      {/* 유의성 판정 */}
      <div className="significance-section">
        <h3>변경 유의성</h3>
        <div className="significance-badge" style={{ borderColor: sig.color }}>
          <span className="sig-label" style={{ color: sig.color }}>{sig.text}</span>
          <span className="sig-desc">{sig.desc}</span>
          <span className="sig-detail">
            z-score: {result.significance.z_score.toFixed(2)}, p-value: {result.significance.p_value.toFixed(3)}
          </span>
        </div>
      </div>

      {/* 이봉 감지 */}
      {result.bimodal_detected && (
        <div className="bimodal-section">
          <h3>이봉 감지</h3>
          <p>두 개의 최적 영역이 발견되었습니다:</p>
          <div className="peaks-list">
            {result.peaks.map((peak, i) => (
              <div key={i} className={`peak-item ${peak.is_primary ? 'primary' : ''}`}>
                <span>{peak.is_primary ? '주 피크' : '부 피크'}</span>
                <span className="peak-value">{peak.cm360.toFixed(1)} cm/360</span>
                <span className="peak-score">score: {peak.score.toFixed(3)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DNA 요약 (있으면) */}
      {result.partial_dna && (
        <div className="dna-section">
          <h3>Aim DNA 요약</h3>
          <div className="dna-grid">
            <DnaStat label="손목/팔 비율" value={result.partial_dna.wrist_arm_ratio} format="percent" />
            <DnaStat label="평균 오버슈트" value={result.partial_dna.avg_overshoot} format="decimal" />
            <DnaStat label="Pre-aim 비율" value={result.partial_dna.pre_aim_ratio} format="percent" />
            <DnaStat label="방향 편향" value={result.partial_dna.direction_bias} format="decimal" />
            {result.partial_dna.tracking_smoothness !== null && (
              <DnaStat label="트래킹 부드러움" value={result.partial_dna.tracking_smoothness} format="decimal" />
            )}
          </div>
          {result.adaptation_rate !== null && (
            <div className="adaptation-rate">
              적응 속도: {(result.adaptation_rate * 100).toFixed(1)}%
              {result.adaptation_rate > 0.1
                ? ' (빠른 적응 — 감도 변경에 유연)'
                : result.adaptation_rate < -0.05
                  ? ' (피로 경향)'
                  : ' (보통)'}
            </div>
          )}
        </div>
      )}

      {/* 적응 편향 고지 */}
      <div className="bias-notice">
        최적 감도는 테스트 환경 기반 추정값입니다. 실제 게임에서 1~2주 적응 후
        재측정을 권장합니다.
      </div>

      {/* 통계 */}
      <div className="result-stats">
        총 {result.total_iterations}회 반복 | 관측점 {result.observations.length}개
      </div>

      {/* 버튼 */}
      <div className="result-actions">
        <button className="btn-secondary" onClick={onBack}>
          뒤로
        </button>
        <button
          className="btn-primary"
          onClick={() => onApply(result.recommended_cm360)}
        >
          감도 적용
        </button>
      </div>
    </div>
  );
}

/** DNA 통계 항목 */
function DnaStat({
  label,
  value,
  format,
}: {
  label: string;
  value: number;
  format: 'percent' | 'decimal';
}) {
  const display = format === 'percent'
    ? `${(value * 100).toFixed(0)}%`
    : value.toFixed(3);

  return (
    <div className="dna-stat">
      <span className="dna-stat-label">{label}</span>
      <span className="dna-stat-value">{display}</span>
    </div>
  );
}
