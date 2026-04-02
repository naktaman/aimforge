/**
 * HUD 타이머 — 상단 중앙
 * 시간 기반 시나리오: 남은 시간 카운트다운 (MM:SS)
 * 타겟 카운트 기반: 경과 시간 (SS.s) + 타겟 진행 표시
 */
import { motion, AnimatePresence } from 'motion/react';
import type { GameMetrics } from '../../hooks/useGameMetrics';

interface Props {
  metrics: GameMetrics;
}

/** ms → MM:SS 포맷 */
function formatCountdown(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

/** ms → SS.s 포맷 (경과 시간) */
function formatElapsed(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const tenths = Math.floor((ms % 1000) / 100);
  return `${sec}.${tenths}`;
}

export function HUDTimer({ metrics }: Props) {
  const isCountdown = metrics.durationMs > 0;
  const isLowTime = isCountdown && metrics.remainingMs <= 5000;

  return (
    <div className="hud-timer">
      <AnimatePresence mode="wait">
        {isCountdown ? (
          <motion.span
            key="countdown"
            className={`hud-timer-value ${isLowTime ? 'hud-timer-low' : ''}`}
            initial={{ opacity: 0.8 }}
            animate={{
              opacity: 1,
              scale: isLowTime ? [1, 1.05, 1] : 1,
            }}
            transition={{ duration: 0.3 }}
          >
            {formatCountdown(metrics.remainingMs)}
          </motion.span>
        ) : (
          <span className="hud-timer-value">
            {formatElapsed(metrics.elapsedMs)}
          </span>
        )}
      </AnimatePresence>

      {/* 타겟 카운트 기반 시나리오: 진행 표시 */}
      {metrics.targetProgress && (
        <span className="hud-timer-progress">
          {metrics.targetProgress.current}/{metrics.targetProgress.total}
        </span>
      )}
    </div>
  );
}
