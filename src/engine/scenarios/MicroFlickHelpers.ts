/**
 * MicroFlickScenario 헬퍼 함수 및 상수
 * 순수 함수로 분리하여 테스트 용이성 확보
 */
import type { Direction, MicroFlickTrialMetrics, TrajectoryType } from '../../utils/types';
import type { MetricsCollector } from '../metrics/MetricsCollector';
import {
  calculateTrackingScore,
  calculateFlickScore,
  calculateMicroFlickScore,
} from '../metrics/CompositeScore';

/** 8방향 섹터 정의 */
export const DIRECTION_SECTORS: Array<{ dir: Direction; min: number; max: number }> = [
  { dir: 'right', min: -22.5, max: 22.5 },
  { dir: 'upper_right', min: 22.5, max: 67.5 },
  { dir: 'up', min: 67.5, max: 112.5 },
  { dir: 'upper_left', min: 112.5, max: 157.5 },
  { dir: 'left', min: 157.5, max: 202.5 },
  { dir: 'lower_left', min: 202.5, max: 247.5 },
  { dir: 'down', min: 247.5, max: 292.5 },
  { dir: 'lower_right', min: 292.5, max: 337.5 },
];

/** 각도 버킷 */
export const BUCKETS = [10, 30, 60, 90, 120, 150, 180];

/** 재획득 판정 임계값: 타겟 각도 반지름의 2배 이내 */
export const REACQUIRE_MULTIPLIER = 2;

/** 인터럽트 플릭 타임아웃 (ms) */
export const FLICK_TIMEOUT = 3000;

/** azimuth → 8방향 분류 */
export function getDirection(azimuthDeg: number): Direction {
  const norm = ((azimuthDeg % 360) + 360) % 360;
  for (const sector of DIRECTION_SECTORS) {
    if (sector.min < 0) {
      if (norm >= 360 + sector.min || norm < sector.max) return sector.dir;
    } else if (norm >= sector.min && norm < sector.max) {
      return sector.dir;
    }
  }
  return 'right';
}

/** 각도 → 가장 가까운 버킷 */
export function getNearestBucket(angleDeg: number): number {
  let closest = BUCKETS[0];
  let minDiff = Infinity;
  for (const bucket of BUCKETS) {
    const diff = Math.abs(angleDeg - bucket);
    if (diff < minDiff) {
      minDiff = diff;
      closest = bucket;
    }
  }
  return closest;
}

/** 최종 결과 계산 (순수 함수) */
export function computeMicroFlickResults(
  metrics: MetricsCollector,
  trajectory: TrajectoryType,
): MicroFlickTrialMetrics {
  const hybrid = metrics.computeHybridMetrics(trajectory);
  const trackingScore = calculateTrackingScore(
    hybrid.tracking.mad,
    hybrid.tracking.velocityMatchRatio,
  );
  const flickScore = calculateFlickScore(
    hybrid.flick.hitRate,
    hybrid.flick.avgTtt,
    hybrid.flick.avgOvershoot,
    hybrid.flick.preFireRatio,
  );
  const compositeScore = calculateMicroFlickScore(
    trackingScore,
    flickScore,
    hybrid.avgReacquireTimeMs,
  );

  return {
    trackingMad: hybrid.tracking.mad,
    trackingVelocityMatch: hybrid.tracking.velocityMatchRatio,
    flickHitRate: hybrid.flick.hitRate,
    flickAvgTtt: hybrid.flick.avgTtt,
    avgReacquireTimeMs: hybrid.avgReacquireTimeMs,
    compositeScore,
  };
}
