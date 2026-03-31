/**
 * 히트 판정 유틸리티
 * angular distance 방식 — Raycaster보다 정확하고 메트릭 활용에 유리
 */
import * as THREE from 'three';

/**
 * 카메라 정면 방향과 타겟 사이의 각도 거리 (라디안)
 * angular_dist = acos(dot(cameraForward, targetDir))
 */
export function angularDistance(
  cameraPos: THREE.Vector3,
  cameraForward: THREE.Vector3,
  targetPos: THREE.Vector3,
): number {
  const toTarget = new THREE.Vector3()
    .subVectors(targetPos, cameraPos)
    .normalize();
  // dot product clamping으로 acos 범위 안전 보장
  const dot = Math.max(-1, Math.min(1, cameraForward.dot(toTarget)));
  return Math.acos(dot);
}

/**
 * 히트 판정: 각도 오차가 타겟 각도 반지름보다 작으면 히트
 */
export function isHit(
  angularDist: number,
  targetAngularRadius: number,
): boolean {
  return angularDist <= targetAngularRadius;
}
