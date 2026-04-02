/**
 * 수렴 진행률 바
 * 공식: progress = 1 - (current_max_σ / initial_max_σ)
 */
import { motion } from 'motion/react';
import type { ConvergenceModeType } from '../../utils/gpTypes';
import { CONVERGENCE_MODE_CONFIG } from '../../utils/gpTypes';

interface ConvergenceBarProps {
  progress: number;
  mode: ConvergenceModeType;
  iteration: number;
  maxIterations: number;
}

export function ConvergenceBar({ progress, mode, iteration, maxIterations }: ConvergenceBarProps) {
  const percent = Math.round(progress * 100);
  const config = CONVERGENCE_MODE_CONFIG[mode];

  return (
    <div className="convergence-bar-container">
      <div className="convergence-bar-header">
        <span className="convergence-bar-title">수렴 진행률</span>
        <span className="convergence-bar-percent">{percent}%</span>
      </div>

      {/* 진행률 바 */}
      <div className="convergence-bar-track">
        <motion.div
          className="convergence-bar-fill"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>

      {/* 라운드 정보 */}
      <div className="convergence-bar-info">
        <span>라운드 {iteration} / {maxIterations}</span>
        <span className="convergence-bar-mode">
          {config.label} 모드 (예상 {config.expectedRounds[0]}~{config.expectedRounds[1]}라운드)
        </span>
      </div>
    </div>
  );
}
