/**
 * 클릭 타이밍 분류
 * 클릭 시점의 크로스헤어 속도/가속도로 PreAim / PreFire / Flick 분류
 */
import type { ClickType } from '../../utils/types';

/**
 * 클릭 분류
 * - PreAim: 속도 < 30°/s + 감속 중 (충분히 멈춘 후 정조준 클릭)
 * - PreFire: 속도 > 100°/s (이동 중 사전 발사)
 * - Flick: 나머지 (일반적인 플릭 샷)
 */
export function classifyClick(
  velocity: number,
  isDecelerating: boolean,
): ClickType {
  if (velocity < 30 && isDecelerating) return 'PreAim';
  if (velocity > 100) return 'PreFire';
  return 'Flick';
}
