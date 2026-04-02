/**
 * 타겟 스폰 유틸리티
 * 120° 방위각 제한 — 모든 시나리오에서 공통 사용
 * 카메라 정면 기준 ±60° (총 120°) 범위 내에서만 스폰
 */

/** 방위각 제한: 카메라 정면 기준 ±60° */
const AZIMUTH_HALF_RANGE = 60; // degrees

/**
 * 제한된 방위각 생성 — 카메라 정면 ±60° 범위 내
 * 반환값: -60 ~ +60 도
 */
export function constrainedAzimuth(): number {
  return (Math.random() * AZIMUTH_HALF_RANGE * 2) - AZIMUTH_HALF_RANGE;
}
