/**
 * 차트/데이터 시각화 애니메이션 유틸리티 훅
 * requestAnimationFrame 기반 — 정확한 타이밍 + 부드러운 모션
 *
 * 포함 훅:
 * - useAnimatedValue: 0→목표값 보간 (차트 바, 게이지 등)
 * - useCountUp: 정수/실수 카운트업 (점수, 통계)
 * - useStaggeredReveal: 순차 등장 인덱스 (바 차트, 리스트)
 * - useDrawProgress: 0→1 선형 진행 (SVG pathLength, 라인 그리기)
 */
import { useState, useEffect, useRef } from 'react';
import { useReducedMotion } from './useReducedMotion';

/** easeOutCubic — 빠르게 시작, 느리게 끝남 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** easeOutExpo — 극적인 초기 가속 */
function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/**
 * 0 → target 까지 부드럽게 보간하는 값 반환
 * 바 차트 높이, 게이지 각도, 퍼센트 등에 사용
 * @param target 목표값
 * @param duration 애니메이션 시간 (ms), 기본 800
 * @param delay 시작 딜레이 (ms), 기본 0
 */
export function useAnimatedValue(
  target: number,
  duration = 800,
  delay = 0,
): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(reduced ? target : 0);
  const prevTarget = useRef(target);

  useEffect(() => {
    if (reduced) {
      setValue(target);
      return;
    }

    const startVal = prevTarget.current !== target ? value : 0;
    prevTarget.current = target;
    let startTime: number | null = null;
    let raf: number;

    const animate = (now: number): void => {
      if (!startTime) startTime = now + delay;
      const elapsed = now - startTime;

      if (elapsed < 0) {
        raf = requestAnimationFrame(animate);
        return;
      }

      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      setValue(startVal + (target - startVal) * eased);

      if (progress < 1) {
        raf = requestAnimationFrame(animate);
      }
    };

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- startVal은 안정적
  }, [target, duration, delay, reduced]);

  return value;
}

/**
 * 숫자 카운트업 — 정수 또는 소수점 자릿수 지정
 * 점수, 정확도%, 반응시간ms 등에 사용
 * @param target 목표 숫자
 * @param duration 애니메이션 시간 (ms), 기본 1200
 * @param decimals 소수점 자릿수, 기본 0
 * @param delay 시작 딜레이 (ms), 기본 0
 */
export function useCountUp(
  target: number,
  duration = 1200,
  decimals = 0,
  delay = 0,
): string {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(
    reduced ? target.toFixed(decimals) : (0).toFixed(decimals),
  );

  useEffect(() => {
    if (reduced) {
      setDisplay(target.toFixed(decimals));
      return;
    }

    let startTime: number | null = null;
    let raf: number;

    const animate = (now: number): void => {
      if (!startTime) startTime = now + delay;
      const elapsed = now - startTime;

      if (elapsed < 0) {
        raf = requestAnimationFrame(animate);
        return;
      }

      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutExpo(progress);
      const current = target * eased;
      setDisplay(current.toFixed(decimals));

      if (progress < 1) {
        raf = requestAnimationFrame(animate);
      }
    };

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, decimals, delay, reduced]);

  return display;
}

/**
 * 순차 등장 인덱스 — 바 차트, 리스트 아이템 순차 공개
 * 현재까지 보여줄 마지막 인덱스를 반환
 * @param totalItems 전체 아이템 수
 * @param staggerMs 아이템 간 딜레이 (ms), 기본 80
 * @param initialDelay 첫 아이템 딜레이 (ms), 기본 200
 */
export function useStaggeredReveal(
  totalItems: number,
  staggerMs = 80,
  initialDelay = 200,
): number {
  const reduced = useReducedMotion();
  const [revealedCount, setRevealedCount] = useState(reduced ? totalItems : 0);

  useEffect(() => {
    if (reduced || totalItems <= 0) {
      setRevealedCount(totalItems);
      return;
    }

    setRevealedCount(0);
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (let i = 0; i < totalItems; i++) {
      timers.push(
        setTimeout(() => setRevealedCount(i + 1), initialDelay + i * staggerMs),
      );
    }

    return () => timers.forEach(clearTimeout);
  }, [totalItems, staggerMs, initialDelay, reduced]);

  return revealedCount;
}

/**
 * SVG 선 그리기 진행도 (0→1)
 * pathLength와 조합하여 선이 그려지는 효과
 * @param duration 애니메이션 시간 (ms), 기본 1000
 * @param delay 시작 딜레이 (ms), 기본 0
 * @param trigger 변경 시 애니메이션 재실행 (데이터 변경 감지)
 */
export function useDrawProgress(
  duration = 1000,
  delay = 0,
  trigger?: unknown,
): number {
  const reduced = useReducedMotion();
  const [progress, setProgress] = useState(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      setProgress(1);
      return;
    }

    setProgress(0);
    let startTime: number | null = null;
    let raf: number;

    const animate = (now: number): void => {
      if (!startTime) startTime = now + delay;
      const elapsed = now - startTime;

      if (elapsed < 0) {
        raf = requestAnimationFrame(animate);
        return;
      }

      const p = Math.min(elapsed / duration, 1);
      setProgress(easeOutCubic(p));

      if (p < 1) {
        raf = requestAnimationFrame(animate);
      }
    };

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, delay, reduced, trigger]);

  return progress;
}

/**
 * D3 차트용 트랜지션 적용 헬퍼
 * D3 selection에 fade-in + draw 애니메이션을 적용
 */
export function applyD3LineAnimation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- d3 selection 타입 호환
  selection: any,
  duration = 800,
  delay = 0,
): void {
  const totalLength = selection.node()?.getTotalLength?.() ?? 0;
  if (totalLength === 0) return;

  selection
    .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
    .attr('stroke-dashoffset', totalLength)
    .transition()
    .delay(delay)
    .duration(duration)
    .ease(easeOutCubic)
    .attr('stroke-dashoffset', 0);
}

/**
 * D3 차트용 점 순차 등장 헬퍼
 */
export function applyD3PointAnimation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- d3 selection 타입 호환
  selection: any,
  staggerMs = 60,
  delay = 400,
): void {
  selection
    .attr('r', 0)
    .attr('opacity', 0)
    .transition()
    .delay((_d: unknown, i: number) => delay + i * staggerMs)
    .duration(400)
    .ease(easeOutCubic)
    .attr('r', selection.attr('r') || 3.5)
    .attr('opacity', 1);
}

/**
 * D3 영역(area) 페이드인 헬퍼
 */
export function applyD3AreaFadeIn(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- d3 selection 타입 호환
  selection: any,
  duration = 600,
  delay = 0,
): void {
  selection
    .attr('opacity', 0)
    .transition()
    .delay(delay)
    .duration(duration)
    .ease(easeOutCubic)
    .attr('opacity', selection.attr('opacity') || 0.15);
}
