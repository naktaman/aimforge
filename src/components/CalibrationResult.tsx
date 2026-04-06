/**
 * 캘리브레이션 결과 화면
 * 추천 감도, 유의성, 이봉 감지, DNA 요약
 */
import { useCalibrationStore } from '../stores/calibrationStore';
import { useTranslation } from '../i18n';
import { safeInvoke } from '../utils/ipc';
import { useToastStore } from '../stores/toastStore';

interface CalibrationResultProps {
  onBack: () => void;
  onApply: (cm360: number) => void;
  /** 줌 감도 설정으로 이어가기 (옵션 — 없으면 버튼 미표시) */
  onNextZoom?: () => void;
}

/** 유의성 라벨 — i18n 키 매핑 */
const SIGNIFICANCE_LABELS = {
  Recommend: { textKey: 'cal.sigRecommend', color: 'var(--color-hit)', descKey: 'cal.sigRecommendDesc' },
  Marginal: { textKey: 'cal.sigMarginal', color: 'var(--warning)', descKey: 'cal.sigMarginalDesc' },
  Keep: { textKey: 'cal.sigKeep', color: 'var(--info)', descKey: 'cal.sigKeepDesc' },
};

export function CalibrationResult({ onBack, onApply, onNextZoom }: CalibrationResultProps) {
  const { result } = useCalibrationStore();
  const { t } = useTranslation();

  if (!result) {
    return (
      <div className="calibration-result">
        <p>{t('cal.noData')}</p>
        <button className="btn-secondary" onClick={onBack}>{t('common.back')}</button>
      </div>
    );
  }

  const sig = SIGNIFICANCE_LABELS[result.significance.label];
  const delta = result.recommendedCm360 - result.currentCm360;

  /** Performance Landscape 저장 */
  const handleSaveLandscape = async (): Promise<void> => {
    const sessionId = useCalibrationStore.getState().sessionId;
    const peaks = result.peaks.map((p) => ({
      cm360: p.cm360, score: p.score, isPrimary: p.isPrimary,
    }));

    const id = await safeInvoke<number>('save_landscape', {
      params: {
        profile_id: 1,
        calibration_session_id: sessionId,
        gp_mean_curve: JSON.stringify(result.gpCurve),
        confidence_bands: JSON.stringify([]),
        scenario_overlays: JSON.stringify([]),
        bimodal_peaks: JSON.stringify(peaks),
      },
    });
    if (id !== null) {
      useToastStore.getState().addToast(t('cal.landscapeSaved'), 'success');
    }
  };

  return (
    <div className="calibration-result">
      <h2>{t('cal.resultTitle')}</h2>

      {/* 추천 감도 */}
      <div className="result-recommendation">
        <div className="result-card primary">
          <span className="card-label">{t('cal.recommended')}</span>
          <span className="big-number">{result.recommendedCm360.toFixed(1)}</span>
          <span className="unit">cm/360</span>
        </div>
        <div className="result-card secondary">
          <span className="card-label">{t('cal.currentSens')}</span>
          <span className="medium-number">{result.currentCm360.toFixed(1)}</span>
          <span className="unit">cm/360</span>
        </div>
        <div className="result-card delta">
          <span className="card-label">{t('cal.delta')}</span>
          <span className="medium-number">
            {delta > 0 ? '+' : ''}{delta.toFixed(1)}
          </span>
          <span className="unit">cm/360</span>
        </div>
      </div>

      {/* 유의성 판정 */}
      <div className="significance-section">
        <h3>{t('cal.significance')}</h3>
        <div className="significance-badge" style={{ borderColor: sig.color }}>
          <span className="sig-label" style={{ color: sig.color }}>{t(sig.textKey)}</span>
          <span className="sig-desc">{t(sig.descKey)}</span>
          <span className="sig-detail">
            z-score: {result.significance.zScore.toFixed(2)}, p-value: {result.significance.pValue.toFixed(3)}
          </span>
        </div>
      </div>

      {/* 이봉 감지 */}
      {result.bimodalDetected && (
        <div className="bimodal-section">
          <h3>{t('cal.bimodal')}</h3>
          <p>{t('cal.bimodalDesc')}</p>
          <div className="peaks-list">
            {result.peaks.map((peak, i) => (
              <div key={i} className={`peak-item ${peak.isPrimary ? 'primary' : ''}`}>
                <span>{peak.isPrimary ? t('cal.primaryPeak') : t('cal.secondaryPeak')}</span>
                <span className="peak-value">{peak.cm360.toFixed(1)} cm/360</span>
                <span className="peak-score">score: {peak.score.toFixed(3)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DNA 요약 (있으면) */}
      {result.partialDna && (
        <div className="dna-section">
          <h3>{t('cal.dnaSummary')}</h3>
          <div className="dna-grid">
            <DnaStat label={t('dna.wristArmRatio')} value={result.partialDna.wristArmRatio} format="percent" />
            <DnaStat label={t('dna.avgOvershoot')} value={result.partialDna.avgOvershoot} format="decimal" />
            <DnaStat label={t('dna.preAimRatio')} value={result.partialDna.preAimRatio} format="percent" />
            <DnaStat label={t('dna.directionBias')} value={result.partialDna.directionBias} format="decimal" />
            {result.partialDna.trackingSmoothness !== null && (
              <DnaStat label={t('dna.trackingSmoothness')} value={result.partialDna.trackingSmoothness} format="decimal" />
            )}
          </div>
          {result.adaptationRate !== null && (
            <div className="adaptation-rate">
              {t('cal.adaptationRate')}: {(result.adaptationRate * 100).toFixed(1)}%
              {result.adaptationRate > 0.1
                ? ` (${t('cal.fastAdapt')})`
                : result.adaptationRate < -0.05
                  ? ` (${t('cal.fatigueTrend')})`
                  : ` (${t('cal.normal')})`}
            </div>
          )}
        </div>
      )}

      {/* 적응 편향 고지 */}
      <div className="bias-notice">
        {t('cal.biasNotice')}
      </div>

      {/* 통계 */}
      <div className="result-stats">
        {t('cal.totalIterations').replace('{n}', String(result.totalIterations))} | {t('cal.observationCount').replace('{n}', String(result.observations.length))}
      </div>

      {/* 버튼 */}
      <div className="result-actions">
        <button className="btn-secondary" onClick={onBack}>
          {t('common.back')}
        </button>
        <button className="btn-secondary" onClick={handleSaveLandscape}>
          {t('cal.saveLandscape')}
        </button>
        <button
          className="btn-primary"
          onClick={() => onApply(result.recommendedCm360)}
        >
          {t('cal.applySens')}
        </button>
        {/* 줌 감도 설정 이어가기 — 통합 플로우 */}
        {onNextZoom && (
          <button className="btn-secondary" onClick={onNextZoom}>
            다음: 줌 감도 설정 →
          </button>
        )}
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
