/**
 * ElementTransition — 개별 UI 요소 입장/퇴장 애니메이션
 * stagger 효과로 리스트 아이템이 순차적으로 나타남
 * GPU 가속 속성(transform, opacity)만 사용
 */
import type { ReactNode } from 'react';
import { motion } from 'motion/react';

/** 기본 stagger 간격 (초) */
const DEFAULT_STAGGER = 0.04;
/** 기본 등장 시간 (초) */
const DEFAULT_DURATION = 0.2;

interface ElementTransitionProps {
  /** 자식 요소 */
  children: ReactNode;
  /** stagger 순서 인덱스 (0부터) */
  index?: number;
  /** stagger 간격 (초, 기본 0.04s) */
  stagger?: number;
  /** 등장 시간 (초, 기본 0.2s) */
  duration?: number;
  /** 추가 className */
  className?: string;
}

/**
 * 개별 요소 fade-up 입장 애니메이션
 * - index * stagger 만큼 delay하여 순차 등장
 * - y: 12px → 0px + opacity: 0 → 1
 */
export function ElementTransition({
  children,
  index = 0,
  stagger = DEFAULT_STAGGER,
  duration = DEFAULT_DURATION,
  className,
}: ElementTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{
        opacity: 1,
        y: 0,
        transition: {
          duration,
          ease: 'easeOut',
          delay: index * stagger,
        },
      }}
      className={className}
      style={{ willChange: 'transform, opacity' }}
    >
      {children}
    </motion.div>
  );
}
