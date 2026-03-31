/**
 * 변환 방식 비교 결과 화면
 * 6가지 방식 비교 테이블 + AI 추천 배지 + 효과 크기
 */
import type { ComparatorResult as ComparatorResultType } from '../stores/zoomCalibrationStore';

interface ComparatorResultProps {
  result: ComparatorResultType;
  onBack: () => void;
  onSave?: () => void;
}

/** 효과 크기 해석 */
function effectSizeLabel(d: number | null): string {
  if (d === null) return '-';
  if (d < 0.2) return '무시';
  if (d < 0.5) return '소';
  if (d < 0.8) return '중';
  return '대';
}

/** p-value 유의성 표시 */
function significanceMarker(p: number | null): string {
  if (p === null) return '';
  if (p < 0.01) return ' **';
  if (p < 0.05) return ' *';
  return '';
}

export function ComparatorResult({ result, onBack, onSave }: ComparatorResultProps) {
  return (
    <div className="comparator-result">
      <h2>변환 방식 비교 결과</h2>
      <p className="summary">{result.summary}</p>

      {/* 결과 테이블 */}
      <table className="comparator-table">
        <thead>
          <tr>
            <th>순위</th>
            <th>방식</th>
            <th>Steady</th>
            <th>Correction</th>
            <th>Zoomout</th>
            <th>합성</th>
            <th>효과 크기</th>
            <th>p-value</th>
          </tr>
        </thead>
        <tbody>
          {result.method_scores.map((ms) => (
            <tr key={ms.method} className={ms.is_recommended ? 'recommended' : ''}>
              <td>
                {ms.rank}
                {ms.is_recommended && <span className="star"> ★</span>}
              </td>
              <td className="method-name">{ms.method}</td>
              <td>{ms.steady_mean.toFixed(1)}</td>
              <td>{ms.correction_mean.toFixed(1)}</td>
              <td>{ms.zoomout_mean.toFixed(1)}</td>
              <td className="composite">
                {ms.composite_mean.toFixed(1)}
                <span className="std"> ±{ms.composite_std.toFixed(1)}</span>
              </td>
              <td className={`effect-size ${effectSizeLabel(ms.effect_size)}`}>
                {ms.effect_size !== null ? ms.effect_size.toFixed(2) : '-'}
                <span className="effect-label"> ({effectSizeLabel(ms.effect_size)})</span>
              </td>
              <td className="p-value">
                {ms.p_value !== null ? ms.p_value.toFixed(3) : '-'}
                {significanceMarker(ms.p_value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 범례 */}
      <div className="comparator-legend">
        <span>★ AI 추천</span>
        <span>* p &lt; 0.05</span>
        <span>** p &lt; 0.01</span>
      </div>

      {/* 버튼 */}
      <div className="comparator-actions">
        <button className="btn-secondary" onClick={onBack}>
          돌아가기
        </button>
        {onSave && (
          <button className="btn-primary" onClick={onSave}>
            결과 저장
          </button>
        )}
      </div>
    </div>
  );
}
