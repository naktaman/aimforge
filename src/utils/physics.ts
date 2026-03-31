/**
 * 물리 변환 유틸리티 — Rust game_db/conversion.rs와 동일한 공식
 * 렌더 루프에서 사용하기 위한 TypeScript 미러
 */

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/**
 * 마우스 raw delta → 센티미터 변환
 * 공식: cm = counts / dpi × 2.54
 */
export function rawToCm(dx: number, dy: number, dpi: number): [number, number] {
  if (dpi === 0) return [0, 0];
  const factor = 2.54 / dpi;
  return [dx * factor, dy * factor];
}

/**
 * 센티미터 이동량 → 회전 각도(도) 변환
 * 공식: degrees = cm / cmPer360 × 360
 */
export function cmToDegrees(cm: number, cmPer360: number): number {
  if (cmPer360 === 0) return 0;
  return (cm / cmPer360) * 360;
}

/**
 * 게임 감도 + DPI → cm/360 변환
 * 공식: cm360 = (360 / (sens × yaw × dpi)) × 2.54
 */
export function gameSensToCm360(sens: number, dpi: number, yaw: number): number {
  const denominator = sens * yaw * dpi;
  if (denominator === 0) return 0;
  return (360 / denominator) * 2.54;
}

/**
 * cm/360 → 게임 감도 역변환
 * 공식: sens = (360 × 2.54) / (cm360 × yaw × dpi)
 */
export function cm360ToSens(cm360: number, dpi: number, yaw: number): number {
  const denominator = cm360 * yaw * dpi;
  if (denominator === 0) return 0;
  return (360 * 2.54) / denominator;
}

/**
 * 게임 FOV 설정값 → 실제 수평 FOV 변환
 * vertical FOV 게임(R6, BF)의 경우 aspect ratio로 hFOV 계산
 */
export function gameFovToHfov(
  gameFov: number,
  fovType: string,
  aspectRatio: number,
): number {
  if (fovType === 'horizontal') return gameFov;
  // vertical → horizontal: hFOV = 2 × atan(tan(vFOV/2) × aspectRatio)
  const vFovRad = gameFov * DEG2RAD;
  const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * aspectRatio);
  return hFovRad * RAD2DEG;
}

/**
 * 줌 배율 계산 (k-parameter 모델)
 * 공식: mult = (tan(hipfire/2) / tan(scope/2))^k
 */
export function zoomMultiplier(
  fovHipfire: number,
  fovScope: number,
  k: number,
): number {
  const hipRad = fovHipfire * DEG2RAD;
  const scopeRad = fovScope * DEG2RAD;
  const ratio = Math.tan(hipRad / 2) / Math.tan(scopeRad / 2);
  return Math.pow(ratio, k);
}

/**
 * 수평 FOV → 수직 FOV 역변환
 * vFOV = 2 × atan(tan(hFOV/2) / aspectRatio)
 */
export function hfovToVfov(hfovDeg: number, aspectRatio: number): number {
  const hRad = hfovDeg * DEG2RAD;
  const vRad = 2 * Math.atan(Math.tan(hRad / 2) / aspectRatio);
  return vRad * RAD2DEG;
}

/**
 * MDM(Monitor Distance Match) p% 배율 계산
 * mult = (tan(dst/2) / tan(src/2))^(1 - p/100)
 * MDM 0%: 순수 FOV 탄젠트 비율, MDM 100%: 배율 1.0
 */
export function mdmMultiplier(srcFovH: number, dstFovH: number, mdmPct: number): number {
  const srcRad = (srcFovH * DEG2RAD) / 2;
  const dstRad = (dstFovH * DEG2RAD) / 2;
  const fovRatio = Math.tan(dstRad) / Math.tan(srcRad);
  return Math.pow(fovRatio, 1 - mdmPct / 100);
}

/**
 * Viewspeed H(수평) 배율 — FOV 각도 직접 비율
 */
export function viewspeedHMultiplier(srcFovH: number, dstFovH: number): number {
  if (srcFovH === 0) return 1;
  return dstFovH / srcFovH;
}

/**
 * Viewspeed V(수직) 배율 — vFOV 비율
 */
export function viewspeedVMultiplier(srcFovH: number, dstFovH: number, aspectRatio: number): number {
  const srcVfov = hfovToVfov(srcFovH, aspectRatio);
  const dstVfov = hfovToVfov(dstFovH, aspectRatio);
  if (srcVfov === 0) return 1;
  return dstVfov / srcVfov;
}

/**
 * 6가지 변환 방식 동시 계산
 * 각 방식별 배율을 cm/360에 적용: dst_cm360 = src_cm360 / mult
 */
export function convertAllMethods(
  srcFovH: number,
  dstFovH: number,
  srcCm360: number,
  aspectRatio: number,
): Record<string, number> {
  const results: Record<string, number> = {};

  // MDM 0%, 56.25%, 75%, 100%
  for (const [label, pct] of [
    ['MDM_0', 0],
    ['MDM_56.25', 56.25],
    ['MDM_75', 75],
    ['MDM_100', 100],
  ] as const) {
    const mult = mdmMultiplier(srcFovH, dstFovH, pct);
    results[label] = srcCm360 / mult;
  }

  // Viewspeed H/V
  results['Viewspeed_H'] = srcCm360 / viewspeedHMultiplier(srcFovH, dstFovH);
  results['Viewspeed_V'] = srcCm360 / viewspeedVMultiplier(srcFovH, dstFovH, aspectRatio);

  return results;
}

/**
 * sens_step 스냅 — 최적 cm/360에 가장 가까운 게임 감도 후보 2개
 */
export function snapSensitivity(
  targetCm360: number,
  dpi: number,
  yaw: number,
  sensStep: number,
): { floorSens: number; floorCm360: number; ceilSens: number; ceilCm360: number } {
  const idealSens = cm360ToSens(targetCm360, dpi, yaw);
  const floorSens = Math.floor(idealSens / sensStep) * sensStep;
  const ceilSens = Math.ceil(idealSens / sensStep) * sensStep;
  const floorCm360 = floorSens > 0 ? gameSensToCm360(floorSens, dpi, yaw) : Infinity;
  const ceilCm360 = gameSensToCm360(ceilSens, dpi, yaw);
  return { floorSens, floorCm360, ceilSens, ceilCm360 };
}

export { DEG2RAD, RAD2DEG };
