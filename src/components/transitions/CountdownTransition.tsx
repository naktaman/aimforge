/**
 * CountdownTransition — 게임 시작 카운트다운 숫자 애니메이션
 * 시나리오 6: 숫자 scale(2→1) + fade, 각 숫자 800ms
 * AnimatePresence로 숫자 교체 시 exit/enter 처리
 */
import { motion, AnimatePresence } from 'motion/react';

/** 카운트다운 애니메이션 시간 (초) */
const COUNTDOWN_DURATION = 0.8;

interface CountdownTransitionProps {
  /** 현재 카운트다운 숫자 (null이면 비표시) */
  count: number | null;
}

/**
 * 카운트다운 숫자 애니메이션
 * - scale: 2 → 1 (큰 숫자에서 정상 크기로 수렴)
 * - opacity: 0 → 1 → 0 (페이드 인/아웃)
 * - GPU 가속: transform + opacity만 사용
 */
export function CountdownTransition({ count }: CountdownTransitionProps) {
  return (
    <AnimatePresence mode="wait">
      {count !== null && count > 0 && (
        <motion.div
          key={count}
          className="countdown-number"
          initial={{ opacity: 0, scale: 2 }}
          animate={{
            opacity: 1,
            scale: 1,
            transition: {
              duration: COUNTDOWN_DURATION * 0.4,
              ease: 'easeOut',
            },
          }}
          exit={{
            opacity: 0,
            scale: 0.8,
            transition: {
              duration: COUNTDOWN_DURATION * 0.3,
              ease: 'easeIn',
            },
          }}
          style={{ willChange: 'transform, opacity' }}
        >
          {count}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
