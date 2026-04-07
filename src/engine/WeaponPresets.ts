/**
 * 무기 프리셋 정의
 * - 기존 호환 프리셋 (default, ar_cs2, sniper_pubg, smg, zoom_*)
 * - 신규 시나리오 전용 6종 (기획서 §6.1)
 */
import type { WeaponConfig } from '../utils/types';

// ── 6종 시나리오 무기 프리셋 (기획서 §6.1) ──

/** Flick Pistol — 싱글샷, 반동 없음, 플릭 정확도만 측정 */
const PRESET_FLICK_PISTOL: WeaponConfig = {
  id: 'flick_pistol', name: 'Flick Pistol', category: 'pistol',
  fireMode: 'single', fireRateRpm: 240,
  magazineSize: 12, reloadTimeMs: 1500,
  firstShotAccuracy: 0, baseSpread: 0.5,
  recoilType: 'none', recoilPattern: [], recoilResetMs: 500,
  recoilRandomDeviation: 0,
  zoomMultiplier: 1, zoomFov: 103, zoomSensMultiplier: 1,
  bulletDropEnabled: false, bulletDropGravity: 9.81, bulletVelocity: 900,
  viewmodelStyle: 'pistol',
};

/** Tracking Rifle — 풀오토, 미미한 수직 반동, 추적 훈련용 */
const PRESET_TRACKING_RIFLE: WeaponConfig = {
  id: 'tracking_rifle', name: 'Tracking Rifle', category: 'rifle',
  fireMode: 'auto', fireRateRpm: 660,
  magazineSize: 50, reloadTimeMs: 2500,
  firstShotAccuracy: 0, baseSpread: 1.0,
  recoilType: 'fixed',
  recoilPattern: [
    [0, -0.3], [0.05, -0.3], [-0.05, -0.3], [0.03, -0.3], [-0.03, -0.3],
    [0.05, -0.3], [-0.05, -0.3], [0.03, -0.3], [-0.03, -0.3], [0, -0.3],
  ],
  recoilResetMs: 400, recoilRandomDeviation: 0.15,
  zoomMultiplier: 1.5, zoomFov: 70, zoomSensMultiplier: 0.8,
  bulletDropEnabled: false, bulletDropGravity: 9.81, bulletVelocity: 900,
  viewmodelStyle: 'rifle',
};

/** Spray AR — CS2 스타일 고정 패턴, 스프레이 보정 훈련용 */
const PRESET_SPRAY_AR: WeaponConfig = {
  id: 'spray_ar', name: 'Spray AR', category: 'rifle',
  fireMode: 'auto', fireRateRpm: 600,
  magazineSize: 30, reloadTimeMs: 2000,
  firstShotAccuracy: 0, baseSpread: 0.3,
  recoilType: 'fixed',
  recoilPattern: [
    [0, -0.8], [0.1, -1.0], [-0.1, -1.2], [0.2, -1.0], [-0.2, -0.8],
    [0.3, -0.6], [-0.3, -0.9], [0.1, -1.1], [-0.1, -0.7], [0.2, -0.5],
    [-0.2, -0.8], [0.3, -1.0], [-0.3, -0.6], [0.1, -0.4], [-0.1, -0.7],
    [0.2, -0.9], [-0.2, -0.5], [0.3, -0.3], [-0.3, -0.6], [0.1, -0.8],
    [0, -0.4], [0.2, -0.6], [-0.2, -0.3], [0.1, -0.5], [0, -0.4],
    [-0.1, -0.6], [0.2, -0.3], [-0.1, -0.5], [0.1, -0.4], [0, -0.3],
  ],
  recoilResetMs: 400, recoilRandomDeviation: 0.2,
  zoomMultiplier: 1, zoomFov: 103, zoomSensMultiplier: 1,
  bulletDropEnabled: false, bulletDropGravity: 9.81, bulletVelocity: 900,
  viewmodelStyle: 'rifle',
};

/** Burst AR — 3발 버스트, 버스트 간 리셋 */
const PRESET_BURST_AR: WeaponConfig = {
  id: 'burst_ar', name: 'Burst AR', category: 'rifle',
  fireMode: 'burst', fireRateRpm: 450, burstCount: 3, burstInternalRpm: 800,
  magazineSize: 24, reloadTimeMs: 2000,
  firstShotAccuracy: 0, baseSpread: 1.5,
  recoilType: 'fixed',
  recoilPattern: [
    [0, -0.8], [0.15, -1.5], [-0.15, -1.8],
  ],
  recoilResetMs: 300, recoilRandomDeviation: 0.2,
  zoomMultiplier: 2, zoomFov: 51.5, zoomSensMultiplier: 0.7,
  bulletDropEnabled: false, bulletDropGravity: 9.81, bulletVelocity: 900,
  viewmodelStyle: 'rifle',
};

/** Precision Sniper — 볼트액션, ADS 필수, 장거리 플릭 */
const PRESET_PRECISION_SNIPER: WeaponConfig = {
  id: 'precision_sniper', name: 'Precision Sniper', category: 'sniper',
  fireMode: 'bolt', fireRateRpm: 40,
  magazineSize: 5, reloadTimeMs: 3500,
  firstShotAccuracy: 0, baseSpread: 0,
  recoilType: 'fixed',
  recoilPattern: [[0, -4.0]],
  recoilResetMs: 2000, recoilRandomDeviation: 0.1,
  zoomMultiplier: 4, zoomFov: 25.75, zoomSensMultiplier: 0.5,
  bulletDropEnabled: true, bulletDropGravity: 9.81, bulletVelocity: 945,
  viewmodelStyle: 'rifle',
};

/** Bloom SMG — Apex 스타일 블룸, 빠른 연사 + 정확도 관리 훈련 */
const PRESET_BLOOM_SMG: WeaponConfig = {
  id: 'bloom_smg', name: 'Bloom SMG', category: 'smg',
  fireMode: 'auto', fireRateRpm: 900,
  magazineSize: 35, reloadTimeMs: 1800,
  firstShotAccuracy: 0.5, baseSpread: 0.5,
  recoilType: 'bloom',
  bloomPerShot: 2, bloomMax: 30, bloomRecoveryRate: 10,
  recoilPattern: [], recoilResetMs: 300, recoilRandomDeviation: 0.3,
  zoomMultiplier: 1.25, zoomFov: 82, zoomSensMultiplier: 0.9,
  bulletDropEnabled: false, bulletDropGravity: 9.81, bulletVelocity: 400,
  viewmodelStyle: 'rifle',
};

// ── 기존 호환 프리셋 + 신규 6종 ──

/** 무기 프리셋 목록 */
export const WEAPON_PRESETS: Record<string, WeaponConfig> = {
  /** 기본 (반동/드롭 없음) */
  default: {
    fireRateRpm: 0,
    recoilPattern: [],
    recoilResetMs: 500,
    zoomMultiplier: 1,
    zoomFov: 103,
    zoomSensMultiplier: 1,
    bulletDropEnabled: false,
    bulletDropGravity: 9.81,
    bulletVelocity: 900,
  },
  /** AR 타입 (CS2 AK-47 스타일) — 기존 호환 */
  ar_cs2: {
    fireRateRpm: 600,
    recoilPattern: [
      [0, -0.8], [0.1, -1.0], [-0.1, -1.2], [0.2, -1.0], [-0.2, -0.8],
      [0.3, -0.6], [-0.3, -0.9], [0.1, -1.1], [-0.1, -0.7], [0.2, -0.5],
      [-0.2, -0.8], [0.3, -1.0], [-0.3, -0.6], [0.1, -0.4], [-0.1, -0.7],
      [0.2, -0.9], [-0.2, -0.5], [0.3, -0.3], [-0.3, -0.6], [0.1, -0.8],
      [0, -0.4], [0.2, -0.6], [-0.2, -0.3], [0.1, -0.5], [0, -0.4],
      [-0.1, -0.6], [0.2, -0.3], [-0.1, -0.5], [0.1, -0.4], [0, -0.3],
    ],
    recoilResetMs: 400,
    zoomMultiplier: 1,
    zoomFov: 103,
    zoomSensMultiplier: 1,
    bulletDropEnabled: false,
    bulletDropGravity: 9.81,
    bulletVelocity: 900,
  },
  /** 스나이퍼 (PUBG AWM 스타일) — 기존 호환 */
  sniper_pubg: {
    fireRateRpm: 25,
    recoilPattern: [[0, -4.0]],
    recoilResetMs: 2000,
    zoomMultiplier: 8,
    zoomFov: 13,
    zoomSensMultiplier: 0.35,
    bulletDropEnabled: true,
    bulletDropGravity: 9.81,
    bulletVelocity: 945,
  },
  /** SMG (빠른 연사) — 기존 호환 */
  smg: {
    fireRateRpm: 900,
    recoilPattern: [
      [0, -0.3], [0.1, -0.4], [-0.1, -0.3], [0.05, -0.35], [-0.05, -0.3],
      [0.1, -0.25], [-0.1, -0.3], [0.05, -0.35], [-0.05, -0.25], [0, -0.3],
    ],
    recoilResetMs: 300,
    zoomMultiplier: 1,
    zoomFov: 103,
    zoomSensMultiplier: 1,
    bulletDropEnabled: false,
    bulletDropGravity: 9.81,
    bulletVelocity: 400,
  },

  // ── 줌 프리셋 (기존 호환) ──
  zoom_1x: {
    fireRateRpm: 0, recoilPattern: [], recoilResetMs: 500,
    zoomMultiplier: 1, zoomFov: 103, zoomSensMultiplier: 1,
    bulletDropEnabled: false, bulletDropGravity: 9.81, bulletVelocity: 900,
  },
  zoom_2x: {
    fireRateRpm: 0, recoilPattern: [], recoilResetMs: 500,
    zoomMultiplier: 2, zoomFov: 51.5, zoomSensMultiplier: 0.7,
    bulletDropEnabled: false, bulletDropGravity: 9.81, bulletVelocity: 900,
  },
  zoom_4x: {
    fireRateRpm: 0, recoilPattern: [], recoilResetMs: 500,
    zoomMultiplier: 4, zoomFov: 25.75, zoomSensMultiplier: 0.5,
    bulletDropEnabled: false, bulletDropGravity: 9.81, bulletVelocity: 900,
  },
  zoom_6x: {
    fireRateRpm: 0, recoilPattern: [], recoilResetMs: 500,
    zoomMultiplier: 6, zoomFov: 17, zoomSensMultiplier: 0.42,
    bulletDropEnabled: true, bulletDropGravity: 9.81, bulletVelocity: 900,
  },
  zoom_8x: {
    fireRateRpm: 0, recoilPattern: [], recoilResetMs: 500,
    zoomMultiplier: 8, zoomFov: 13, zoomSensMultiplier: 0.35,
    bulletDropEnabled: true, bulletDropGravity: 9.81, bulletVelocity: 900,
  },
  zoom_10x: {
    fireRateRpm: 0, recoilPattern: [], recoilResetMs: 500,
    zoomMultiplier: 10, zoomFov: 10.3, zoomSensMultiplier: 0.3,
    bulletDropEnabled: true, bulletDropGravity: 9.81, bulletVelocity: 900,
  },
  zoom_12x: {
    fireRateRpm: 0, recoilPattern: [], recoilResetMs: 500,
    zoomMultiplier: 12, zoomFov: 8.6, zoomSensMultiplier: 0.25,
    bulletDropEnabled: true, bulletDropGravity: 9.81, bulletVelocity: 900,
  },

  // ── 신규 시나리오 프리셋 6종 ──
  flick_pistol: PRESET_FLICK_PISTOL,
  tracking_rifle: PRESET_TRACKING_RIFLE,
  spray_ar: PRESET_SPRAY_AR,
  burst_ar: PRESET_BURST_AR,
  precision_sniper: PRESET_PRECISION_SNIPER,
  bloom_smg: PRESET_BLOOM_SMG,
};

/** 시나리오 전용 프리셋 목록 (UI에서 선택지로 노출) */
export const SCENARIO_WEAPON_PRESETS = [
  PRESET_FLICK_PISTOL,
  PRESET_TRACKING_RIFLE,
  PRESET_SPRAY_AR,
  PRESET_BURST_AR,
  PRESET_PRECISION_SNIPER,
  PRESET_BLOOM_SMG,
] as const;
