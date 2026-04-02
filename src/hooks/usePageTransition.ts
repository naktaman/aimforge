/**
 * 화면 전환 상태 관리 훅
 * engineStore의 screen 상태와 연동하여 전환 타입/방향 결정
 */
import { useRef, useMemo } from 'react';
import type { Variants } from 'motion/react';
import type { AppScreen } from '../stores/engineStore';
import { useReducedMotion } from './useReducedMotion';

/* ── 전환 타입 정의 ── */
export type TransitionType =
  | 'crossfade'       // 기본: opacity만 전환
  | 'fade-to-black'   // 빠른 암전 후 복귀 (viewport 진입)
  | 'slide-up'        // 아래→위 슬라이드 + fade (결과 화면)
  | 'scale-fade';     // scale(0.95→1) + fade (설정/모달류)

/* ── 전환 시간 상수 (ms → s) ── */
const DURATION_CROSSFADE = 0.2;
const DURATION_FADE_TO_BLACK = 0.15;
const DURATION_SLIDE_UP = 0.25;
const DURATION_SCALE_FADE = 0.2;

/** 즉시 전환 (reduced motion용, 0초) */
const INSTANT: Variants = {
  initial: { opacity: 1 },
  animate: { opacity: 1 },
  exit: { opacity: 1 },
};

/** crossfade: opacity 전환, 200ms, ease-out */
const CROSSFADE: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: DURATION_CROSSFADE, ease: 'easeOut' } },
  exit: { opacity: 0, transition: { duration: DURATION_CROSSFADE, ease: 'easeIn' } },
};

/** fade-to-black: 빠른 암전 (150ms out + 150ms in) */
const FADE_TO_BLACK: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: DURATION_FADE_TO_BLACK, ease: 'easeOut' } },
  exit: { opacity: 0, transition: { duration: DURATION_FADE_TO_BLACK, ease: 'easeIn' } },
};

/** slide-up: 아래에서 올라오며 fade, 250ms */
const SLIDE_UP: Variants = {
  initial: { opacity: 0, y: 40 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION_SLIDE_UP, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: { duration: DURATION_SLIDE_UP, ease: 'easeIn' },
  },
};

/** scale-fade: scale(0.95→1) + fade, spring 기반 */
const SCALE_FADE: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', stiffness: 300, damping: 25, duration: DURATION_SCALE_FADE },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: DURATION_SCALE_FADE, ease: 'easeIn' },
  },
};

/** 전환 타입 → Variants 매핑 */
const VARIANT_MAP: Record<TransitionType, Variants> = {
  crossfade: CROSSFADE,
  'fade-to-black': FADE_TO_BLACK,
  'slide-up': SLIDE_UP,
  'scale-fade': SCALE_FADE,
};

/**
 * 화면 전환 시나리오에 따른 전환 타입 결정
 * @param from - 이전 화면
 * @param to - 다음 화면
 */
function resolveTransitionType(from: AppScreen | null, to: AppScreen): TransitionType {
  /* 스플래시 → 다음 화면: fade-to-black (프리미엄 전환) */
  if (from === 'splash') return 'fade-to-black';

  /* 웰컴 → 다음 화면: crossfade */
  if (from === 'welcome') return 'crossfade';

  /* 시나리오 2: 게임 플레이 진입 → fade-to-black (긴장감) */
  if (to === 'viewport') return 'fade-to-black';

  /* 시나리오 3: 게임 → 결과 화면 → slide-up */
  if (from === 'viewport' && to === 'results') return 'slide-up';

  /* 시나리오 5: 설정/모달류 화면 → scale-fade */
  const MODAL_SCREENS: AppScreen[] = [
    'display-settings', 'game-profiles', 'recoil-editor',
    'conversion-selector', 'profile-wizard',
  ];
  if (MODAL_SCREENS.includes(to)) return 'scale-fade';

  /* 시나리오 1, 4 기본: crossfade */
  return 'crossfade';
}

/**
 * 화면 전환 variants + 메타데이터 반환
 * @param currentScreen - 현재 활성 화면
 */
export function usePageTransition(currentScreen: AppScreen) {
  const reducedMotion = useReducedMotion();
  /** 이전 화면 추적 */
  const prevScreenRef = useRef<AppScreen | null>(null);

  const result = useMemo(() => {
    const transitionType = resolveTransitionType(prevScreenRef.current, currentScreen);
    const variants = reducedMotion ? INSTANT : VARIANT_MAP[transitionType];

    return { transitionType, variants };
  }, [currentScreen, reducedMotion]);

  /* 이전 화면 갱신 (memo 이후) */
  prevScreenRef.current = currentScreen;

  return result;
}
