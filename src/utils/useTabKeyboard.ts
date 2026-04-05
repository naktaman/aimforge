/**
 * 탭 리스트 키보드 네비게이션 훅
 * 좌우 화살표키로 탭 이동, Home/End로 처음/끝 탭 이동
 * WAI-ARIA Tabs 패턴 준수
 */
import { useCallback, useRef } from 'react';

/**
 * role="tablist" 컨테이너에 연결할 onKeyDown 핸들러를 반환.
 * - ArrowLeft / ArrowRight: 이전/다음 탭으로 포커스 이동 + 선택
 * - Home / End: 첫/끝 탭으로 포커스 이동 + 선택
 *
 * @param keys 탭 키 배열 (순서대로)
 * @param onSelect 탭 선택 콜백
 */
export function useTabKeyboard<T extends string>(
  keys: readonly T[],
  onSelect: (key: T) => void,
) {
  const containerRef = useRef<HTMLDivElement>(null);

  /** 탭리스트 내 [role="tab"] 버튼들 조회 */
  const getTabs = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];
    return Array.from(containerRef.current.querySelectorAll<HTMLElement>('[role="tab"]'));
  }, []);

  /** 키보드 이벤트 핸들러 */
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const tabs = getTabs();
    if (tabs.length === 0) return;

    const currentIndex = tabs.findIndex(t => t === document.activeElement);
    if (currentIndex === -1) return;

    let nextIndex: number | null = null;

    switch (e.key) {
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = tabs.length - 1;
        break;
      default:
        return; // 다른 키는 기본 동작 유지
    }

    e.preventDefault();
    tabs[nextIndex].focus();
    if (keys[nextIndex] !== undefined) {
      onSelect(keys[nextIndex]);
    }
  }, [keys, onSelect, getTabs]);

  return { containerRef, onKeyDown };
}
