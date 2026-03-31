/**
 * 공유 TypeScript 타입 정의
 */

/** Rust MouseEvent와 대응하는 프론트엔드 타입 */
export interface MouseEvent {
  delta_x: number;
  delta_y: number;
  timestamp_us: number;
  button: 'Left' | 'Right' | 'Middle' | null;
}

/** Rust MouseBatch와 대응 — drain_mouse_batch 반환값 */
export interface MouseBatch {
  events: MouseEvent[];
  total_dx: number;
  total_dy: number;
  button_events: MouseEvent[];
}

/** 게임 프리셋 (Rust GamePreset 대응) */
export interface GamePreset {
  id: string;
  name: string;
  yaw: number;
  default_fov: number;
  fov_type: 'horizontal' | 'vertical';
  default_aspect_ratio: number;
  /** 감도 최소 단위 (null이면 제한 없음) */
  sens_step: number | null;
  /** 이동 시 감도 가중 비율 */
  movement_ratio: number;
}

/** 방식별 변환 결과 */
export interface ConversionResult {
  cm360: number;
  sens: number;
  multiplier: number;
}

/** 6가지 변환 방식 동시 계산 결과 */
export interface AllMethodsConversion {
  src_game: string;
  dst_game: string;
  src_cm360: number;
  src_fov_h: number;
  dst_fov_h: number;
  results: Record<string, ConversionResult>;
}

/** sens_step 스냅 결과 */
export interface SnappedSensitivity {
  floor_sens: number;
  floor_cm360: number;
  ceil_sens: number;
  ceil_cm360: number;
  recommended_sens: number;
  recommended_cm360: number;
}

/** 변환 방식 이름 */
export type ConversionMethod = 'MDM_0' | 'MDM_56.25' | 'MDM_75' | 'MDM_100' | 'Viewspeed_H' | 'Viewspeed_V';

/** 엔진 설정 */
export interface EngineConfig {
  /** 마우스 DPI */
  dpi: number;
  /** cm/360 (감도의 보편 단위) */
  cmPer360: number;
  /** 수평 FOV (도) */
  hfov: number;
  /** 캔버스 종횡비 */
  aspectRatio: number;
}

/** 시나리오 타입 유니온 */
export type ScenarioType =
  | 'flick'
  | 'tracking'
  | 'circular_tracking'
  | 'stochastic_tracking'
  | 'counter_strafe_flick'
  | 'micro_flick'
  | 'zoom_steady'
  | 'zoom_correction'
  | 'zoom_reacquisition'
  | 'zoom_composite';

/** 시나리오 공통 설정 */
export interface ScenarioConfig {
  type: ScenarioType;
  targetSizeDeg: number;
}

/** Static Flick 시나리오 설정 */
export interface FlickConfig extends ScenarioConfig {
  type: 'flick';
  angleRange: [number, number];
  numTargets: number;
  timeout: number;
}

/** Linear Tracking 시나리오 설정 */
export interface TrackingConfig extends ScenarioConfig {
  type: 'tracking';
  targetSpeedDegPerSec: number;
  directionChanges: number;
  duration: number;
  trajectoryType: TrajectoryType;
}

/** 각도 구간 버킷 */
export const ANGLE_BUCKETS = [10, 30, 60, 90, 120, 150, 180] as const;

/** 8방향 */
export type Direction =
  | 'right'
  | 'upper_right'
  | 'up'
  | 'upper_left'
  | 'left'
  | 'lower_left'
  | 'down'
  | 'lower_right';

/** 운동체계 영역 */
export type MotorRegion = 'finger' | 'wrist' | 'arm';

/** 클릭 타이밍 분류 */
export type ClickType = 'PreAim' | 'PreFire' | 'Flick';

/** 히트 결과 */
export interface HitResult {
  hit: boolean;
  angularError: number;
  targetId: string;
}

/** Flick 트라이얼 메트릭 */
export interface FlickTrialMetrics {
  ttt: number;
  overshoot: number;
  correctionCount: number;
  settleTime: number;
  pathEfficiency: number;
  hit: boolean;
  angleBucket: number;
  direction: Direction;
  motorRegion: MotorRegion;
  clickType: ClickType;
}

/** 궤적 타입 (기존 + 확장) */
export type TrajectoryType =
  | 'horizontal'
  | 'vertical'
  | 'mixed'
  | 'circular'
  | 'stochastic';

/** Tracking 트라이얼 메트릭 */
export interface TrackingTrialMetrics {
  mad: number;
  deviationVariance: number;
  phaseLag: number;
  velocityMatchRatio: number;
  trajectoryType: TrajectoryType;
}

// ========== 신규 시나리오 Config ==========

/** Circular Tracking 시나리오 설정 */
export interface CircularTrackingConfig extends ScenarioConfig {
  type: 'circular_tracking';
  /** 궤도 기본 반지름 (도) */
  orbitRadiusDeg: number;
  /** 궤도 속도 (도/초) */
  orbitSpeedDegPerSec: number;
  /** 반지름 변동 비율 (0~1, 0=완전 원형) */
  radiusVariation: number;
  /** 속도 변동 비율 (0~1) */
  speedVariation: number;
  /** 지속 시간 (ms) */
  duration: number;
  /** 타겟 거리 (m) */
  distance: number;
}

/** Stochastic Tracking 시나리오 설정 */
export interface StochasticTrackingConfig extends ScenarioConfig {
  type: 'stochastic_tracking';
  /** Perlin noise 진행 속도 (높을수록 급격한 변화) */
  noiseSpeed: number;
  /** 최대 진폭 (도) */
  amplitudeDeg: number;
  /** 지속 시간 (ms) */
  duration: number;
  /** 타겟 거리 (m) */
  distance: number;
}

/** Counter-Strafe Flick 시나리오 설정 */
export interface CounterStrafeFlickConfig extends ScenarioConfig {
  type: 'counter_strafe_flick';
  /** 정지 대기 시간 (ms) — stop_time 시뮬레이션 */
  stopTimeMs: number;
  /** 스트레이프 속도 (도/초, 시각적 환경 이동) */
  strafeSpeedDegPerSec: number;
  /** 타겟 수 */
  numTargets: number;
  /** 플릭 각도 범위 [min, max] (도) */
  angleRange: [number, number];
  /** 플릭 타임아웃 (ms) */
  timeout: number;
}

/** Micro-Flick (Tracking + Flick 하이브리드) 시나리오 설정 */
export interface MicroFlickConfig extends ScenarioConfig {
  type: 'micro_flick';
  /** 플릭 인터럽트 주파수 (Hz) */
  switchFrequencyHz: number;
  /** 메인 트래킹 타겟 속도 (도/초) */
  trackingSpeedDegPerSec: number;
  /** 인터럽트 플릭 각도 범위 [min, max] (도) */
  flickAngleRange: [number, number];
  /** 지속 시간 (ms) */
  duration: number;
  /** 타겟 거리 (m) */
  distance: number;
}

/** 줌 티어 (배율 단계) */
export type ZoomTier = '1x' | '3x' | '6x+';

/** Zoom Phase 공통 설정 */
export interface ZoomPhaseConfig extends ScenarioConfig {
  type: 'zoom_steady' | 'zoom_correction' | 'zoom_reacquisition';
  /** hipfire 수평 FOV (도) */
  hipfireFov: number;
  /** 스코프 수평 FOV (도) */
  scopeFov: number;
  /** 스코프 감도 배율 */
  scopeMultiplier: number;
  /** 줌 티어 */
  zoomTier: ZoomTier;
  /** 타겟 거리 (m) */
  distance: number;
  /** 지속 시간 또는 타겟 수 기반 지속 (ms) */
  duration: number;
  /** 타겟 수 (Phase B, C에서 사용) */
  numTargets: number;
}

/** Zoom Composite Runner 설정 */
export interface ZoomCompositeConfig {
  type: 'zoom_composite';
  /** Phase A 설정 */
  steady: ZoomPhaseConfig;
  /** Phase B 설정 */
  correction: ZoomPhaseConfig;
  /** Phase C 설정 */
  reacquisition: ZoomPhaseConfig;
  /** 가중치 */
  weights: ZoomPhaseWeights;
}

/** Zoom 3-Phase 가중치 */
export interface ZoomPhaseWeights {
  steady: number;
  correction: number;
  zoomout: number;
}

/** Zoom Phase별 결과 */
export interface ZoomPhaseResult {
  score: number;
  phase: 'steady' | 'correction' | 'reacquisition';
  zoomTier: ZoomTier;
}

/** Zoom 복합 결과 */
export interface ZoomTrialMetrics {
  steadyScore: number;
  correctionScore: number;
  reacquisitionScore: number;
  compositeScore: number;
  zoomTier: ZoomTier;
  /** 과보정 비율 (Phase B) */
  overCorrectionRatio: number;
  /** 과소보정 비율 (Phase B) */
  underCorrectionRatio: number;
}

/** Zoom Correction 개별 타겟 결과 */
export interface ZoomCorrectionResult {
  /** 줌 전환 직후 각도 오차 (rad) */
  jumpOffset: number;
  /** 보정 시간 (ms) */
  correctionTime: number;
  /** 과보정 여부 */
  overCorrected: boolean;
  /** 과소보정 여부 */
  underCorrected: boolean;
  /** 클릭 시점 각도 오차 (rad) */
  settledError: number;
  /** 히트 여부 */
  hit: boolean;
}

/** Zoom Reacquisition 개별 타겟 결과 */
export interface ZoomReacquisitionResult {
  /** 줌 해제 직후 각도 오차 (rad) */
  unzoomOffset: number;
  /** 재획득 시간 (ms) */
  reacquisitionTime: number;
  /** 재획득 성공 여부 */
  reacquired: boolean;
}

/** MicroFlick 하이브리드 결과 */
export interface MicroFlickTrialMetrics {
  /** 트래킹 구간 MAD */
  trackingMad: number;
  /** 트래킹 속도 매칭 비율 */
  trackingVelocityMatch: number;
  /** 인터럽트 플릭 히트율 */
  flickHitRate: number;
  /** 인터럽트 플릭 평균 TTT */
  flickAvgTtt: number;
  /** 평균 재획득 시간 (ms) */
  avgReacquireTimeMs: number;
  /** 복합 점수 */
  compositeScore: number;
}

// ========== 시나리오 배터리 ==========

/** 배터리 프리셋 */
export type BatteryPreset = 'TACTICAL' | 'MOVEMENT' | 'BR' | 'CUSTOM';

/** 배터리 가중치 (시나리오 타입별) */
export interface BatteryWeights {
  flick: number;
  tracking: number;
  circular_tracking: number;
  stochastic_tracking: number;
  counter_strafe_flick: number;
  micro_flick: number;
  zoom_composite: number;
}

/** 배터리 결과 */
export interface BatteryResult {
  preset: BatteryPreset;
  /** 시나리오별 점수 */
  scores: Partial<Record<ScenarioType, number>>;
  /** 가중 복합 점수 */
  weightedComposite: number;
  /** 사용된 가중치 */
  weights: BatteryWeights;
}

// ========== Aim DNA ==========

/** 완성된 Aim DNA 프로파일 (Rust AimDnaProfile 대응) */
export interface AimDnaProfile {
  profile_id: number;
  session_id: number;
  flick_peak_velocity: number | null;
  overshoot_avg: number | null;
  direction_bias: number | null;
  effective_range: number | null;
  tracking_mad: number | null;
  phase_lag: number | null;
  smoothness: number | null;
  velocity_match: number | null;
  micro_freq: number | null;
  wrist_arm_ratio: number | null;
  fitts_a: number | null;
  fitts_b: number | null;
  fatigue_decay: number | null;
  pre_aim_ratio: number | null;
  pre_fire_ratio: number | null;
  sens_attributed_overshoot: number | null;
  v_h_ratio: number | null;
  finger_accuracy: number | null;
  wrist_accuracy: number | null;
  arm_accuracy: number | null;
  motor_transition_angle: number | null;
  adaptation_rate: number | null;
  type_label: string | null;
}

/** Aim DNA 히스토리 항목 */
export interface AimDnaHistoryEntry {
  feature_name: string;
  value: number;
  measured_at: string;
}

/** 세션 요약 */
export interface SessionSummary {
  id: number;
  mode: string;
  session_type: string;
  started_at: string;
  ended_at: string | null;
  total_trials: number;
  avg_fps: number | null;
}

/** 트라이얼 요약 */
export interface TrialSummary {
  id: number;
  scenario_type: string;
  cm360_tested: number;
  composite_score: number;
  created_at: string;
}

/** 세션 상세 (트라이얼 포함) */
export interface SessionDetail {
  session: SessionSummary;
  trials: TrialSummary[];
}

/** 레이더 차트 축 */
export interface RadarAxis {
  label: string;
  key: string;
  value: number;
}
