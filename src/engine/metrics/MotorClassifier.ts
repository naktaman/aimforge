/**
 * 운동체계 분류
 * 물리적 이동 거리(cm)로 finger / wrist / arm 분류
 */
import type { MotorRegion } from '../../utils/types';
import { rawToCm } from '../../utils/physics';

/**
 * 이동 거리 기반 운동체계 분류
 * - finger: <2cm (손가락 미세 조정)
 * - wrist: 2~5cm (손목 회전)
 * - arm: >5cm (팔 전체 이동)
 */
export function classifyMotor(distanceCm: number): MotorRegion {
  if (distanceCm < 2) return 'finger';
  if (distanceCm <= 5) return 'wrist';
  return 'arm';
}

/**
 * 연속 이동의 물리적 거리 계산 (cm)
 * 한 방향 연속 이동을 하나의 단위로 집계
 * distance_cm = sqrt(sum_dx² + sum_dy²) / dpi × 2.54
 */
export function calculateMovementDistance(
  events: Array<{ deltaX: number; deltaY: number }>,
  dpi: number,
): number {
  let sumDx = 0;
  let sumDy = 0;
  for (const e of events) {
    sumDx += e.deltaX;
    sumDy += e.deltaY;
  }
  const [cmX, cmY] = rawToCm(sumDx, sumDy, dpi);
  return Math.sqrt(cmX * cmX + cmY * cmY);
}
