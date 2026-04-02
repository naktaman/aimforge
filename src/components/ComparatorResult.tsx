/**
 * 변환 방식 비교 결과 화면
 * 6가지 방식 비교 테이블 + AI 추천 배지 + 효과 크기
 */
import { useTranslation } from '../i18n';
import type { ComparatorResult as ComparatorResultType } from '../stores/zoomCalibrationStore';

interface ComparatorResultProps {
  result: ComparatorResultType;
  onBack: () => void;
  onSave?: () => void;
}

/** 효과 크기 해석 — i18n 키 반환 */
function effectSizeLabelKey(d: number | null): string {
  if (d === null) return '';
  if (d < 0.2) return 'comparator.effectIgnore';
  if (d < 0.5) return 'comparator.effectSmall';
  if (d < 0.8) return 'comparator.effectMedium';
  return 'comparator.effectLarge';
}

/** p-value 유의성 표시 */
function significanceMarker(p: number | null): string {
  if (p === null) return '';
  if (p < 0.01) return ' **';
  if (p < 0.05) return ' *';
  return '';
}

export function ComparatorResult({ result, onBack, onSave }: ComparatorResultProps) {
  const { t } = useTranslation();

  /** 효과 크기 텍스트 변환 */
  const effectSizeLabel = (d: number | null): string => {
    if (d === null) return '-';
    const key = effectSizeLabelKey(d);
    return key ? t(key) : '-';
  };

  return (
    <div className="comparator-result">
      <h2>{t('comparator.title')}</h2>
      <p className="summary">{result.summary}</p>

      {/* 결과 테이블 */}
      <table className="comparator-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Method</th>
            <th>Steady</th>
            <th>Correction</th>
            <th>Zoomout</th>
            <th>Composite</th>
            <th>Effect Size</th>
            <th>p-value</th>
          </tr>
        </thead>
        <tbody>
          {result.methodScores.map((ms) => (
            <tr key={ms.method} className={ms.isRecommended ? 'recommended' : ''}>
              <td>
                {ms.rank}
                {ms.isRecommended && <span className="star"> ★</span>}
              </td>
              <td className="method-name">{ms.method}</td>
              <td>{ms.steadyMean.toFixed(1)}</td>
              <td>{ms.correctionMean.toFixed(1)}</td>
              <td>{ms.zoomoutMean.toFixed(1)}</td>
              <td className="composite">
                {ms.compositeMean.toFixed(1)}
                <span className="std"> ±{ms.compositeStd.toFixed(1)}</span>
              </td>
              <td className={`effect-size ${effectSizeLabelKey(ms.effectSize)}`}>
                {ms.effectSize !== null ? ms.effectSize.toFixed(2) : '-'}
                <span className="effect-label"> ({effectSizeLabel(ms.effectSize)})</span>
              </td>
              <td className="p-value">
                {ms.pValue !== null ? ms.pValue.toFixed(3) : '-'}
                {significanceMarker(ms.pValue)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 범례 */}
      <div className="comparator-legend">
        <span>★ AI {t('conv.recommended')}</span>
        <span>* p &lt; 0.05</span>
        <span>** p &lt; 0.01</span>
      </div>

      {/* 버튼 */}
      <div className="comparator-actions">
        <button className="btn-secondary" onClick={onBack}>
          {t('common.back')}
        </button>
        {onSave && (
          <button className="btn-primary" onClick={onSave}>
            {t('comparator.saveResult')}
          </button>
        )}
      </div>
    </div>
  );
}
