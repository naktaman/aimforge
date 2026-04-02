/**
 * 최종 결과 표시 컴포넌트
 * 수렴 완료 시: 최적 감도 값 + 게임별 변환 그리드 + 클립보드 복사
 */
import { useState } from 'react';
import { motion } from 'motion/react';
import type { CalibrationResultData, GameSensConversion } from '../../utils/gpTypes';

interface OptimalResultProps {
  result: CalibrationResultData;
  conversions: GameSensConversion[];
  onBack: () => void;
}

export function OptimalResult({ result, conversions, onBack }: OptimalResultProps) {
  const [copied, setCopied] = useState(false);

  /** 결과 텍스트 포맷 (클립보드용) */
  const formatResultText = () => {
    let text = `AimForge 최적 감도: ${result.recommendedCm360.toFixed(1)} cm/360\n`;
    text += `성능 점수: ${(result.recommendedScore * 100).toFixed(0)}점\n`;
    text += `신뢰도: ${result.significance.significant ? '통계적으로 유의미' : '추가 테스트 권장'}\n\n`;
    if (conversions.length > 0) {
      text += '게임별 변환:\n';
      conversions.forEach(c => {
        text += `  ${c.gameName}: ${c.sensitivity} ${c.unit}\n`;
      });
    }
    return text;
  };

  /** 클립보드 복사 */
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatResultText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error('클립보드 복사 실패');
    }
  };

  /** 효과 크기 라벨 */
  const effectLabel = result.significance.effectSize === 'large'
    ? '큰 차이'
    : result.significance.effectSize === 'medium'
    ? '중간 차이'
    : '작은 차이';

  return (
    <div className="optimal-result">
      {/* 메인 수치 */}
      <motion.div
        className="optimal-result-hero"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        <div className="optimal-result-label">최적 감도</div>
        <div className="optimal-result-value">
          {result.recommendedCm360.toFixed(1)}
          <span className="optimal-result-unit">cm/360</span>
        </div>
        <div className="optimal-result-score">
          성능 점수 {(result.recommendedScore * 100).toFixed(0)}점
        </div>
      </motion.div>

      {/* 통계 요약 */}
      <div className="optimal-result-stats">
        <div className="optimal-result-stat">
          <span className="optimal-result-stat-label">총 라운드</span>
          <span className="optimal-result-stat-value">{result.totalIterations}</span>
        </div>
        <div className="optimal-result-stat">
          <span className="optimal-result-stat-label">신뢰도</span>
          <span className={`optimal-result-stat-value ${result.significance.significant ? 'stat-significant' : ''}`}>
            {result.significance.significant ? '유의미' : '추가 필요'}
          </span>
        </div>
        <div className="optimal-result-stat">
          <span className="optimal-result-stat-label">효과 크기</span>
          <span className="optimal-result-stat-value">{effectLabel}</span>
        </div>
        {result.bimodalDetected && (
          <div className="optimal-result-stat optimal-result-stat-warn">
            <span className="optimal-result-stat-label">이봉 감지</span>
            <span className="optimal-result-stat-value">
              {result.peaks.map(p => p.cm360.toFixed(1)).join(' / ')} cm/360
            </span>
          </div>
        )}
      </div>

      {/* 게임별 변환 그리드 */}
      {conversions.length > 0 && (
        <div className="optimal-result-conversions">
          <h3 className="optimal-result-section-title">게임별 감도 변환</h3>
          <div className="optimal-result-grid">
            {conversions.map(c => (
              <div key={c.gameName} className="optimal-result-game-card">
                <span className="optimal-result-game-name">{c.gameName}</span>
                <span className="optimal-result-game-sens">
                  {c.sensitivity} <small>{c.unit}</small>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="optimal-result-actions">
        <button className="btn-secondary" onClick={onBack}>
          대시보드로 돌아가기
        </button>
        <button className="btn-primary" onClick={handleCopy}>
          {copied ? '복사됨!' : '결과 복사'}
        </button>
      </div>
    </div>
  );
}
