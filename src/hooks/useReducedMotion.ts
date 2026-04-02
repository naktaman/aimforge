/**
 * prefers-reduced-motion 미디어쿼리 감지 훅
 * reduced motion 설정 시 모든 전환을 즉시 전환으로 대체
 */
import { useState, useEffect } from 'react';

/** 미디어쿼리 문자열 (SSR 안전) */
const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * OS/브라우저의 reduced-motion 설정을 실시간 반영
 * @returns true면 애니메이션 비활성화 필요
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(QUERY).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    /** 미디어쿼리 변경 리스너 */
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return reduced;
}
