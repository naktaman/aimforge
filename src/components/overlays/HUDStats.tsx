/**
 * HUD Tier 2 통계 — 우하단 영역
 * 킬 카운트, 반응시간, PB Pace Indicator
 */
import { motion } from 'motion/react';
import type { GameMetrics } from '../../hooks/useGameMetrics';

interface Props {
  metrics: GameMetrics;
}

export function HUDStats({ metrics }: Props) {
  const hasReactionTime = metrics.lastReactionTime > 0;
  const hasPB = metrics.personalBest > 0;

  return (
    <div className="hud-stats">
      {/* 킬 카운트 */}
      <div className="hud-stats-item">
        <span className="hud-stats-value">{metrics.kills}</span>
        <span className="hud-stats-label">KILLS</span>
      </div>

      {/* 반응시간 */}
      {hasReactionTime && (
        <div className="hud-stats-item">
          <motion.span
            className="hud-stats-value"
            key={metrics.lastReactionTime}
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.12 }}
          >
            {metrics.lastReactionTime.toFixed(0)}
          </motion.span>
          <span className="hud-stats-label">RT ms</span>
        </div>
      )}

      {/* PB Pace Indicator */}
      {hasPB && metrics.shots > 0 && (
        <div className="hud-stats-item">
          <span
            className={`hud-stats-pb ${metrics.pbDelta >= 0 ? 'hud-pb-ahead' : 'hud-pb-behind'}`}
          >
            {metrics.pbDelta >= 0 ? '▲' : '▼'}
            {Math.abs(metrics.pbDelta).toFixed(0)}
          </span>
          <span className="hud-stats-label">PB PACE</span>
        </div>
      )}

      {/* 헤드샷 비율 (헤드샷이 1개 이상일 때만) */}
      {metrics.headshots > 0 && (
        <div className="hud-stats-item">
          <span className="hud-stats-value hud-stats-hs">
            {metrics.headshots}
          </span>
          <span className="hud-stats-label">HS</span>
        </div>
      )}
    </div>
  );
}
