/**
 * HUD 정확도 — 좌���단
 * 실시간 정확도 % (hits/shots) + 히트/샷 카운트
 */
import { motion } from 'motion/react';
import type { GameMetrics } from '../../hooks/useGameMetrics';

interface Props {
  metrics: GameMetrics;
}

export function HUDAccuracy({ metrics }: Props) {
  const pct = (metrics.accuracy * 100).toFixed(1);
  // 정확도 색상: 70%+ 초록, 50-70% 노랑, 50% 미만 빨강
  const colorClass =
    metrics.accuracy >= 0.7
      ? 'hud-acc-good'
      : metrics.accuracy >= 0.5
        ? 'hud-acc-mid'
        : 'hud-acc-low';

  return (
    <div className="hud-accuracy">
      <motion.div
        className={`hud-accuracy-value ${colorClass}`}
        key={metrics.hits}
        initial={{ scale: 1.08 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.12 }}
      >
        {metrics.shots > 0 ? `${pct}%` : '--.--%'}
      </motion.div>
      <div className="hud-accuracy-label">ACCURACY</div>
      <div className="hud-accuracy-detail">
        {metrics.hits}/{metrics.shots}
      </div>
    </div>
  );
}
