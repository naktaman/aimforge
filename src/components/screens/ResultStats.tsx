/**
 * 결과 통계 항목 — stagger 애니메이션으로 순차 등장
 * 정확도, 히트/샷, 헤드샷, 반응시간, 콤보, 킬 표시
 */
import { motion } from 'motion/react';

interface StatItem {
  label: string;
  value: string;
  /** 진행 바 표시용 비율 (0-1), null이면 바 없음 */
  ratio?: number;
}

interface ResultStatsProps {
  stats: StatItem[];
}

/** 컨테이너 variants — stagger 타이밍 제어 */
const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12, delayChildren: 2.0 },
  },
};

/** 개별 항목 variants */
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

export function ResultStats({ stats }: ResultStatsProps) {
  return (
    <motion.div
      className="result-stats"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {stats.map((stat) => (
        <motion.div key={stat.label} className="result-stats__item" variants={itemVariants}>
          <div className="result-stats__header">
            <span className="result-stats__label">{stat.label}</span>
            <span className="result-stats__value">{stat.value}</span>
          </div>
          {stat.ratio !== undefined && (
            <div className="result-stats__bar-bg">
              <motion.div
                className="result-stats__bar-fill"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(stat.ratio * 100, 100)}%` }}
                transition={{ duration: 0.8, delay: 2.2, ease: 'easeOut' }}
              />
            </div>
          )}
        </motion.div>
      ))}
    </motion.div>
  );
}
