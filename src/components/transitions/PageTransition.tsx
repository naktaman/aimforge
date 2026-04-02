/**
 * PageTransition — 화면 간 전체 전환 래퍼
 * AnimatePresence + motion.div로 exit/enter 애니메이션 처리
 * GPU 가속 속성(transform, opacity)만 사용
 */
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { Variants } from 'motion/react';

interface PageTransitionProps {
  /** 현재 화면 키 (AnimatePresence key용) */
  screenKey: string;
  /** 전환 variants (usePageTransition에서 제공) */
  variants: Variants;
  /** 자식 요소 */
  children: ReactNode;
  /** 추가 className */
  className?: string;
}

/**
 * 화면 전환 컨테이너
 * - AnimatePresence mode="wait"으로 exit 완료 후 다음 화면 진입
 * - will-change: transform, opacity로 GPU 레이어 힌트
 */
export function PageTransition({ screenKey, variants, children, className }: PageTransitionProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={screenKey}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        className={className}
        style={{ willChange: 'transform, opacity' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
