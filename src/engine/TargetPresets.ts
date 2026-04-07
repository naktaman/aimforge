/**
 * 타겟 프리셋 정의 (B-3 Phase 2)
 * 움직임 난이도 + 타겟 타입 조합으로 구성된 스폰 프리셋
 * 시나리오에서 프리셋 이름으로 간편하게 타겟 생성 가능
 */
import { TARGET_COLORS } from '../config/theme';
import type {
  MovementDifficulty,
  TargetMovementConfig,
} from './TargetMovement';
import { MOVEMENT_DIFFICULTY_PRESETS } from './TargetMovement';

// ═══════════════ 타입 ═══════════════

/** 타겟 형태 */
export type TargetType = 'sphere' | 'humanoid';

/** 타겟 프리셋 설정 — 스폰에 필요한 모든 정보 */
export interface TargetPreset {
  /** 프리셋 이름 (표시용) */
  name: string;
  /** 타겟 형태 */
  type: TargetType;
  /** 각도 크기 (도) */
  angularSizeDeg: number;
  /** 거리 (m) */
  distanceM: number;
  /** 색상 (sphere 전용, 16진수) */
  color?: number;
  /** 고급 움직임 설정 — 없으면 정적 타겟 */
  movement?: TargetMovementConfig;
}

// ═══════════════ 프리셋 정의 ═══════════════

/** 전체 타겟 프리셋 목록 */
export const TARGET_PRESETS: Record<string, TargetPreset> = {
  // ── 구체 타겟 ──

  /** 정적 플릭 타겟 */
  flick_static: {
    name: '정적 플릭',
    type: 'sphere',
    angularSizeDeg: 3.0,
    distanceM: 10,
    color: TARGET_COLORS.flickRed,
  },

  /** Easy 트래킹 — 느린 Perlin 움직임 */
  tracking_easy: {
    name: '트래킹 (Easy)',
    type: 'sphere',
    angularSizeDeg: 3.5,
    distanceM: 10,
    color: TARGET_COLORS.trackingGreen,
    movement: MOVEMENT_DIFFICULTY_PRESETS.easy,
  },

  /** Medium 트래킹 — ADAD 스트레이핑 */
  tracking_medium: {
    name: '트래킹 (Medium)',
    type: 'sphere',
    angularSizeDeg: 3.0,
    distanceM: 10,
    color: TARGET_COLORS.trackingGreen,
    movement: MOVEMENT_DIFFICULTY_PRESETS.medium,
  },

  /** Hard 트래킹 — 복합 패턴 (ADAD + Perlin) */
  tracking_hard: {
    name: '트래킹 (Hard)',
    type: 'sphere',
    angularSizeDeg: 2.5,
    distanceM: 12,
    color: TARGET_COLORS.trackingTeal,
    movement: MOVEMENT_DIFFICULTY_PRESETS.hard,
  },

  /** Extreme 트래킹 — 예측 불가 복합 패턴 */
  tracking_extreme: {
    name: '트래킹 (Extreme)',
    type: 'sphere',
    angularSizeDeg: 2.0,
    distanceM: 15,
    color: TARGET_COLORS.trackingTeal,
    movement: MOVEMENT_DIFFICULTY_PRESETS.extreme,
  },

  // ── 인체형 타겟 ──

  /** 정적 인체형 */
  humanoid_static: {
    name: '인체형 (정적)',
    type: 'humanoid',
    angularSizeDeg: 4.0,
    distanceM: 10,
  },

  /** Easy 인체형 — Perlin 느린 이동 */
  humanoid_easy: {
    name: '인체형 (Easy)',
    type: 'humanoid',
    angularSizeDeg: 4.0,
    distanceM: 10,
    movement: MOVEMENT_DIFFICULTY_PRESETS.easy,
  },

  /** Medium 인체형 — ADAD 스트레이핑 */
  humanoid_medium: {
    name: '인체형 (Medium)',
    type: 'humanoid',
    angularSizeDeg: 4.0,
    distanceM: 10,
    movement: MOVEMENT_DIFFICULTY_PRESETS.medium,
  },

  /** Hard 인체형 — 복합 패턴 */
  humanoid_hard: {
    name: '인체형 (Hard)',
    type: 'humanoid',
    angularSizeDeg: 3.5,
    distanceM: 12,
    movement: MOVEMENT_DIFFICULTY_PRESETS.hard,
  },

  /** Extreme 인체형 — 예측 불가 */
  humanoid_extreme: {
    name: '인체형 (Extreme)',
    type: 'humanoid',
    angularSizeDeg: 3.0,
    distanceM: 15,
    movement: MOVEMENT_DIFFICULTY_PRESETS.extreme,
  },
};

// ═══════════════ 유틸리티 ═══════════════

/** 난이도 + 타겟 타입으로 프리셋 조회 */
export function getPresetByDifficulty(
  difficulty: MovementDifficulty,
  type: TargetType = 'sphere',
): TargetPreset {
  const key = type === 'humanoid'
    ? `humanoid_${difficulty}`
    : `tracking_${difficulty}`;
  return TARGET_PRESETS[key];
}

/** 기존 프리셋에 커스텀 움직임 설정 오버라이드 */
export function createCustomPreset(
  base: TargetPreset,
  movementOverride: Partial<TargetMovementConfig>,
): TargetPreset {
  return {
    ...base,
    movement: base.movement
      ? { ...base.movement, ...movementOverride }
      : { pattern: 'static', speed: 0, rangeX: 0, rangeY: 0, ...movementOverride },
  };
}
