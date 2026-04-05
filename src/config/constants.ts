/**
 * 전역 상수 정의
 * 매직넘버를 의미있는 이름으로 관리
 */

// ===== 점수 계산 (CompositeScore) =====

/** Flick 기본 가중치 (composite 계산용) */
export const COMPOSITE_FLICK_WEIGHT = 0.6;
/** Tracking 기본 가중치 (composite 계산용) */
export const COMPOSITE_TRACKING_WEIGHT = 0.4;

/** Pre-fire ratio 임계값 (초과 시 overshoot 패널티 50% 할인) */
export const PRE_FIRE_RATIO_THRESHOLD = 0.5;
/** Pre-fire 패널티 할인율 */
export const PRE_FIRE_PENALTY_DISCOUNT = 0.5;

/** TTT 정규화 기준값 (ms) — Flick 점수 계산 */
export const FLICK_TTT_BASELINE_MS = 3000;
/** TTT 기본 점수 비율 */
export const FLICK_TTT_BASE_FACTOR = 0.7;
/** TTT 보너스 비율 */
export const FLICK_TTT_BONUS_FACTOR = 0.3;

/** 오버슛 → 패널티 변환 배율 (라디안 → 점수) */
export const OVERSHOOT_PENALTY_MULTIPLIER = 10;

/** MAD → 점수 변환 계수 (낮을수록 좋음) */
export const MAD_SCORE_FACTOR = 500;
/** Velocity match 보너스 배율 */
export const VELOCITY_MATCH_BONUS_MULTIPLIER = 20;

/** Zoom Phase 기본 가중치 */
export const ZOOM_PHASE_WEIGHTS = {
  steady: 0.5,
  correction: 0.3,
  zoomout: 0.2,
} as const;

/** Zoom 보정 속도 정규화 기준값 (ms) */
export const ZOOM_CORRECTION_SPEED_BASELINE_MS = 2000;
/** Zoom 보정 기본 점수 비율 */
export const ZOOM_CORRECTION_BASE_FACTOR = 0.7;
/** Zoom 보정 속도 보너스 비율 */
export const ZOOM_CORRECTION_SPEED_BONUS = 0.3;
/** 과보정 패널티 배율 */
export const OVER_CORRECTION_PENALTY_MULTIPLIER = 15;

/** Zoom 재획득 속도 정규화 기준값 (ms) */
export const ZOOM_REACQUIRE_SPEED_BASELINE_MS = 3000;
/** Zoom 재획득 기본 점수 비율 */
export const ZOOM_REACQUIRE_BASE_FACTOR = 0.7;
/** Zoom 재획득 속도 보너스 비율 */
export const ZOOM_REACQUIRE_SPEED_BONUS = 0.3;

/** MicroFlick 컴포넌트 가중치 */
export const MICRO_FLICK_WEIGHTS = {
  tracking: 0.6,
  flick: 0.3,
  reacquire: 0.1,
} as const;
/** MicroFlick 재획득 보너스 제수 */
export const MICRO_FLICK_REACQUIRE_DIVISOR = 10;

// ===== 시나리오 타이밍 =====

/** Zoom Correction: 타겟 표시 대기 시간 (ms) */
export const ZOOM_PRE_ZOOM_DELAY_MS = 500;
/** Zoom Correction: 보정 타임아웃 (ms) */
export const ZOOM_CORRECTION_TIMEOUT_MS = 3000;

/** Zoom Reacquisition: 줌 트래킹 최소 시간 (ms) */
export const ZOOM_TRACKING_MIN_MS = 1000;
/** Zoom Reacquisition: 줌 트래킹 최대 시간 (ms) */
export const ZOOM_TRACKING_MAX_MS = 3000;
/** Zoom Reacquisition: 재획득 타임아웃 (ms) */
export const ZOOM_REACQUIRE_TIMEOUT_MS = 5000;
/** Zoom Reacquisition: 재획득 판정 각도 임계값 (타겟 반지름의 N배) */
export const ZOOM_REACQUIRE_THRESHOLD_MULTIPLIER = 2;

// ===== 발사 시스템 =====

/** 기본 RPM */
export const DEFAULT_RPM = 600;
/** 점사 연발 수 */
export const BURST_FIRE_COUNT = 3;
/** RPM 최솟값 */
export const RPM_MIN = 60;
/** RPM 최댓값 */
export const RPM_MAX = 1200;

// ===== 타겟 =====

/** 히트 플래시 지속 시간 (초) */
export const HIT_FLASH_DURATION_SEC = 0.3;
/** 히트 시 emissive 강도 */
export const HIT_EMISSIVE_INTENSITY = 0.8;
/** 기본 타겟 emissive 강도 */
export const DEFAULT_TARGET_EMISSIVE_INTENSITY = 0.3;

/** Tracking 시나리오 기본 타겟 거리 (m) */
export const DEFAULT_TRACKING_DISTANCE_M = 10;

// ===== 카메라 / 물리 =====

/** 눈 높이 (m) */
export const EYE_HEIGHT_M = 1.6;

// ===== 환경 (Environment) =====

/** 바닥 그리드 크기 */
export const GRID_SIZE = 100;
/** 바닥 그리드 세분 수 */
export const GRID_DIVISIONS = 50;

/** 조명 강도 */
export const AMBIENT_LIGHT_INTENSITY = 0.4;
export const DIRECTIONAL_LIGHT_INTENSITY = 0.8;
/** 방향광 위치 */
export const DIRECTIONAL_LIGHT_POSITION = { x: 10, y: 20, z: 10 } as const;

// ===== HumanoidTarget 치수 =====

/** 히트존 배율 */
export const HIT_ZONE_MULTIPLIERS = {
  head: 2,
  upper_body: 1,
  lower_body: 0.75,
} as const;

/** 머리 반지름 (m) */
export const HUMANOID_HEAD_RADIUS = 0.12;
/** 몸통 크기 (m) */
export const HUMANOID_TORSO_SIZE = { w: 0.4, h: 0.5, d: 0.25 } as const;
/** 팔 크기 (r, h) */
export const HUMANOID_ARM_SIZE = { r: 0.08, h: 0.45 } as const;
/** 다리 크기 (r, h) */
export const HUMANOID_LEG_SIZE = { r: 0.09, h: 0.5 } as const;

/** 히트존별 emissive 강도 */
export const HUMANOID_EMISSIVE = {
  head: 0.3,
  body: 0.2,
} as const;

// ===== Flick 시나리오 =====

/** 각도 구간 버킷 (°) */
export const FLICK_ANGLE_BUCKETS: number[] = [10, 30, 60, 90, 120, 150, 180];
