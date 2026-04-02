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
  /** 최신 이벤트의 QPC 타임스탬프 (µs) — 입력 레이턴시 계산용 */
  latest_timestamp_us?: number;
}

/** 퍼포먼스 오버레이 데이터 */
export interface PerfData {
  fps: number;
  frameTimeMs: number;
  inputLatencyUs: number;
  geometries: number;
  textures: number;
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

/** 타겟 타입 (구체 or 사람 모양) */
export type TargetType = 'sphere' | 'humanoid';

/** 히트 부위 (humanoid 전용) */
export type HitZone = 'head' | 'body';

/** 히트 결과 */
export interface HitResult {
  hit: boolean;
  angularError: number;
  targetId: string;
  /** humanoid 타겟의 히트 부위 (sphere일 때는 undefined) */
  hitZone?: HitZone;
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
  type_label: string | null;
  data_sufficiency?: Record<string, FeatureSufficiency>;
}

/** 피처별 데이터 충족 상태 */
export interface FeatureSufficiency {
  sufficient: boolean;
  current_count: number;
  required_count: number;
}

/** DNA 추세 분석 결과 */
export interface DnaTrendResult {
  profile_id: number;
  recalibration_recommended: boolean;
  changed_features: FeatureTrendChange[];
  stable_feature_count: number;
  sessions_analyzed: number;
}

/** 피처별 추세 변화 */
export interface FeatureTrendChange {
  feature: string;
  prior_avg: number;
  recent_avg: number;
  change_pct: number;
  direction: string;
}

/** 레퍼런스 게임 감지 결과 */
export interface ReferenceGameResult {
  reference_profile_id: number | null;
  scores: Array<[number, number]>;
}

/** 크로스게임 비교 히스토리 요약 */
export interface CrossGameComparisonSummary {
  id: number;
  profile_a_id: number;
  profile_b_id: number;
  overall_gap: number;
  predicted_days: number;
  created_at: string;
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

// ========== Training Stage 시스템 ==========

/** 훈련 스테이지 카테고리 (세분류 체계) */
export type StageCategory =
  | 'flick'
  | 'tracking'
  | 'switching'
  | 'assessment'
  // 레거시 호환
  | 'flick_shot'
  | 'target_switching'
  | 'close_range'
  | 'long_range';

/** 9개 핵심 세분류 + 레거시 호환 타입 */
export type StageType =
  // ── Flick 세분류 (3): 각도별 독립 DNA 축 ──
  | 'flick_micro'          // 5-15° 마이크로 플릭 (손가락)
  | 'flick_medium'         // 30-60° 미디엄 플릭 (손목) — 가중치 최고
  | 'flick_macro'          // 90-180° 매크로 플릭 (팔)
  // ── Tracking 세분류 (3): 거리별 독립 DNA 축 ──
  | 'tracking_close'       // 근거리 트래킹 (팔 움직임, 10-15m)
  | 'tracking_mid'         // 중거리 트래킹 (손목+팔, 20-30m)
  | 'tracking_long'        // 원거리 트래킹 (손목, 40-60m)
  // ── Switching 세분류 (2): 타겟 간격별 독립 DNA 축 ──
  | 'switching_close'      // 근접 멀티타겟 (15-45° 간격)
  | 'switching_wide'       // 원거리 멀티타겟 (60-150° 간격)
  // ── Assessment (1) ──
  | 'aim_dna_scan'         // Aim DNA 스캔
  // ── 레거시 호환 ──
  | 'static_flick'
  | 'reaction_flick'
  | 'scoped_flick'
  | 'horizontal_tracking'
  | 'aerial_tracking'
  | 'circular_tracking'
  | 'multi_flick'
  | 'zoom_multi_flick'
  | 'close_range_180'
  | 'jump_tracking'
  | 'strafe_tracking'
  | 'long_range_precision'
  | 'bulletdrop_sniping'
  | 'custom_drill';

/** 트래킹 이동 패턴 — 실제 FPS 적 움직임 시뮬레이션 */
export type MovementPattern =
  | 'linear'        // 직선 이동 후 반전
  | 'parabolic'     // 포물선/곡선 이동
  | 'jitter'        // ADAD 스트레이핑 (불규칙 좌우 전환)
  | 'acceleration'  // 가속/감속 이동
  | 'mixed';        // 위 4가지 랜덤 조합

/** 이동 패턴별 설정 */
export interface MovementPatternConfig {
  pattern: MovementPattern;
  /** 기본 속도 (도/초) */
  baseSpeedDegPerSec: number;
  /** 방향 전환 빈도 (회/초) — jitter용 */
  directionChangeFreq?: number;
  /** 가속 배율 — acceleration용 (1.5 = 50% 가속) */
  accelMultiplier?: number;
  /** 곡선 진폭 (도) — parabolic용 */
  arcAmplitudeDeg?: number;
}

/** 트래킹 세분류 시나리오 설정 */
export interface TrackingStageConfig {
  stageType: 'tracking_close' | 'tracking_mid' | 'tracking_long';
  difficulty: DifficultyConfig;
  /** 타겟 거리 (m) */
  distance: number;
  /** 이동 패턴 시퀀스 — 순서대로 전환됨 */
  patterns: MovementPatternConfig[];
  /** 전체 지속 시간 (ms) */
  durationMs: number;
}

/** 플릭 세분류 시나리오 설정 */
export interface FlickStageConfig {
  stageType: 'flick_micro' | 'flick_medium' | 'flick_macro';
  difficulty: DifficultyConfig;
  /** 플릭 각도 범위 [min, max] (도) */
  angleRange: [number, number];
  /** 타겟 수 */
  numTargets: number;
  /** 타겟당 제한 시간 (ms) */
  timeoutMs: number;
}

/** 스위칭 세분류 시나리오 설정 */
export interface SwitchingStageConfig {
  stageType: 'switching_close' | 'switching_wide';
  difficulty: DifficultyConfig;
  /** 타겟 간격 범위 [min, max] (도) */
  separationRange: [number, number];
  /** 웨이브 수 */
  waveCount: number;
  /** 웨이브당 타겟 수 */
  targetsPerWave: number;
}

/** 세분류 시나리오 결과 — DNA 업데이트에 사용 */
export interface SubCategoryResult {
  stageType: StageType;
  category: StageCategory;
  /** 0-100 정규화 점수 */
  score: number;
  accuracy: number;
  /** 플릭 전용: 평균 TTT (ms) */
  avgTttMs?: number;
  /** 플릭 전용: 평균 오버슛 (도) */
  avgOvershootDeg?: number;
  /** 트래킹 전용: MAD (도) */
  trackingMad?: number;
  /** 트래킹 전용: 패턴별 MAD */
  patternScores?: Record<MovementPattern, number>;
  /** 스위칭 전용: 평균 스위치 시간 (ms) */
  avgSwitchTimeMs?: number;
  /** 원시 메트릭 JSON */
  rawMetrics: string;
}

/** 스테이지 메타데이터 */
export interface StageMeta {
  type: StageType;
  category: StageCategory;
  name: string;
  description: string;
  icon: string;
  /** 벤치마크 모드 사용 가능 여부 */
  hasBenchmark: boolean;
}

/** 난이도 설정 — 3층 구조 */
export interface DifficultyConfig {
  mode: 'benchmark' | 'manual' | 'adaptive';
  targetSizeDeg: number;
  targetSpeedDegPerSec: number;
  reactionWindowMs: number;
  targetCount: number;
  adaptiveTargetSuccessRate: number;
}

/** 무기 설정 */
export interface WeaponConfig {
  /** 연사속도 (RPM) */
  fireRateRpm: number;
  /** 반동 패턴 (dx, dy 쌍 배열) */
  recoilPattern: Array<[number, number]>;
  /** 반동 리셋 시간 (ms) */
  recoilResetMs: number;
  /** 줌 배율 (1 = hipfire) */
  zoomMultiplier: number;
  /** 줌 FOV (도) */
  zoomFov: number;
  /** 줌 시 감도 배율 */
  zoomSensMultiplier: number;
  /** Bullet drop 활성화 */
  bulletDropEnabled: boolean;
  /** Bullet drop 계수 (m/s² 중력 시뮬) */
  bulletDropGravity: number;
  /** 탄속 (m/s) */
  bulletVelocity: number;
}

/** 스테이지 결과 (프론트→Rust 전달용) */
export interface StageResult {
  profileId: number;
  stageType: StageType;
  category: StageCategory;
  difficulty: DifficultyConfig;
  accuracy: number;
  avgTtkMs: number;
  avgReactionMs: number;
  avgOvershootDeg: number;
  avgUndershootDeg: number;
  trackingMad: number | null;
  score: number;
  rawMetrics: string;
}

/** 스테이지 추천 (Rust→프론트 반환) */
export interface StageRecommendation {
  stageType: StageType;
  category: StageCategory;
  reason: string;
  priority: number;
  suggestedDifficulty: DifficultyConfig;
}

/** 스테이지 결과 히스토리 행 */
export interface StageResultRow {
  id: number;
  profileId: number;
  stageType: string;
  category: string;
  score: number;
  accuracy: number;
  avgTtkMs: number;
  avgReactionMs: number;
  avgOvershootDeg: number;
  avgUndershootDeg: number;
  trackingMad: number | null;
  createdAt: string;
}

/** 벤치마크 프리셋 */
export interface BenchmarkPreset {
  key: string;
  name: string;
  targetSizeDeg: number;
  targetSpeedDegPerSec: number;
  reactionWindowMs: number;
  targetCount: number;
}

// ========== Cross-Game DNA ==========

/** 피처별 델타 */
export interface FeatureDelta {
  feature: string;
  ref_value: number;
  target_value: number;
  delta_pct: number;
  severity: string;
}

/** 갭 원인 */
export interface GapCause {
  cause_type: string;
  description: string;
  contributing_features: string[];
  severity: number;
}

/** 개선 Phase */
export interface ImprovementPhase {
  phase: number;
  name: string;
  duration_weeks: string;
  actions: string[];
  target_metrics: string[];
  scenarios: string[];
}

/** 크로스게임 비교 결과 */
export interface CrossGameComparison {
  ref_profile_id: number;
  target_profile_id: number;
  reference_game_id: number;
  deltas: FeatureDelta[];
  causes: GapCause[];
  overall_gap: number;
  improvement_plan: { phases: ImprovementPhase[] };
  predicted_days: number;
  timeline: TimelinePrediction;
}

/** 타임라인 예측 */
export interface TimelinePrediction {
  total_days: number;
  bottleneck_feature: string;
  per_feature: Array<{ feature: string; gap_pct: number; estimated_days: number }>;
  disclaimer: string;
}

// ========== 크로스헤어 커스터마이징 ==========

/** 크로스헤어 형태 */
export type CrosshairShape = 'cross' | 'dot' | 'circle' | 't_shape' | 'cross_dot';

/** 크로스헤어 설정 */
export interface CrosshairConfig {
  /** 형태 */
  shape: CrosshairShape;
  /** 내부선 길이 (px) */
  innerLength: number;
  /** 외부선 길이 (px, 0이면 없음) */
  outerLength: number;
  /** 두께 (px) */
  thickness: number;
  /** 센터 갭 (px) */
  gap: number;
  /** 메인 색상 (hex) */
  color: string;
  /** 메인 투명도 (0-1) */
  opacity: number;
  /** 아웃라인 사용 */
  outlineEnabled: boolean;
  /** 아웃라인 두께 (px) */
  outlineThickness: number;
  /** 아웃라인 색상 (hex) */
  outlineColor: string;
  /** 센터 도트 사용 */
  dotEnabled: boolean;
  /** 센터 도트 크기 (px) */
  dotSize: number;
  /** 다이나믹 크로스헤어 (발사 시 벌어짐) */
  dynamicEnabled: boolean;
  /** 다이나믹 벌어짐 크기 (px) */
  dynamicSpread: number;
}

/** 크로스헤어 프리셋 */
export interface CrosshairPreset {
  name: string;
  config: CrosshairConfig;
}

/** 기본 크로스헤어 프리셋 목록 */
export const CROSSHAIR_PRESETS: CrosshairPreset[] = [
  {
    name: 'CS2 Default',
    config: {
      shape: 'cross', innerLength: 5, outerLength: 0, thickness: 1, gap: 3,
      color: '#4ade80', opacity: 1, outlineEnabled: true, outlineThickness: 1,
      outlineColor: '#000000', dotEnabled: false, dotSize: 2,
      dynamicEnabled: false, dynamicSpread: 3,
    },
  },
  {
    name: 'Valorant Default',
    config: {
      shape: 'cross', innerLength: 4, outerLength: 2, thickness: 2, gap: 3,
      color: '#00ff00', opacity: 1, outlineEnabled: true, outlineThickness: 1,
      outlineColor: '#000000', dotEnabled: true, dotSize: 2,
      dynamicEnabled: false, dynamicSpread: 0,
    },
  },
  {
    name: 'Dot Only',
    config: {
      shape: 'dot', innerLength: 0, outerLength: 0, thickness: 0, gap: 0,
      color: '#ff4444', opacity: 1, outlineEnabled: true, outlineThickness: 1,
      outlineColor: '#000000', dotEnabled: true, dotSize: 4,
      dynamicEnabled: false, dynamicSpread: 0,
    },
  },
  {
    name: 'Circle',
    config: {
      shape: 'circle', innerLength: 0, outerLength: 0, thickness: 2, gap: 10,
      color: '#ffffff', opacity: 0.8, outlineEnabled: false, outlineThickness: 0,
      outlineColor: '#000000', dotEnabled: true, dotSize: 2,
      dynamicEnabled: false, dynamicSpread: 0,
    },
  },
  {
    name: 'T-Shape',
    config: {
      shape: 't_shape', innerLength: 6, outerLength: 0, thickness: 2, gap: 2,
      color: '#00ffff', opacity: 1, outlineEnabled: true, outlineThickness: 1,
      outlineColor: '#000000', dotEnabled: false, dotSize: 0,
      dynamicEnabled: false, dynamicSpread: 0,
    },
  },
  {
    name: 'Overwatch Default',
    config: {
      shape: 'cross_dot', innerLength: 5, outerLength: 0, thickness: 2, gap: 4,
      color: '#00ff00', opacity: 1, outlineEnabled: false, outlineThickness: 0,
      outlineColor: '#000000', dotEnabled: true, dotSize: 3,
      dynamicEnabled: true, dynamicSpread: 5,
    },
  },
  {
    name: 'Minimal',
    config: {
      shape: 'cross', innerLength: 3, outerLength: 0, thickness: 1, gap: 2,
      color: '#ffffff', opacity: 0.7, outlineEnabled: false, outlineThickness: 0,
      outlineColor: '#000000', dotEnabled: false, dotSize: 0,
      dynamicEnabled: false, dynamicSpread: 0,
    },
  },
];

// ========== Training Prescription (Day 18) ==========

/** 훈련 처방 항목 */
export interface TrainingPrescription {
  weakness: string;
  scenario_type: string;
  scenario_params: Record<string, unknown>;
  priority: number;
  estimated_min: number;
  source_type: 'single_game' | 'cross_game';
  description: string;
}

// ========== Game Readiness Score (Day 18) ==========

/** Readiness 측정 입력 */
export interface ReadinessInput {
  profile_id: number;
  flick_accuracy: number;
  flick_avg_ttt_ms: number;
  flick_avg_overshoot: number;
  tracking_mad: number;
  tracking_velocity_match: number;
}

/** Readiness 결과 */
export interface ReadinessResult {
  score: number;
  baseline_delta: BaselineDelta;
  daily_advice: string;
  category: 'peak' | 'ready' | 'moderate' | 'rest';
}

/** Baseline 대비 변화율 */
export interface BaselineDelta {
  flick_accuracy_pct: number;
  ttt_pct: number;
  overshoot_pct: number;
  tracking_mad_pct: number;
  velocity_match_pct: number;
}

/** Readiness Score DB 행 */
export interface ReadinessScoreRow {
  id: number;
  profile_id: number;
  score: number;
  baseline_delta: string;
  daily_advice: string | null;
  measured_at: string;
}

// ========== Trajectory Analysis (Day 18) ==========

/** 클릭 벡터 — 궤적 분석 결과 */
export interface ClickVector {
  dx_deg: number;
  dy_deg: number;
  magnitude_deg: number;
  duration_ms: number;
  peak_velocity: number;
  end_velocity: number;
  overshoot: boolean;
  motor_region: 'finger' | 'wrist' | 'arm';
  hit: boolean;
}

/** GMM 단일 클러스터 */
export interface GmmCluster {
  mean: number;
  std_dev: number;
  weight: number;
  sample_count: number;
}

/** GMM 2-컴포넌트 결과 */
export interface GmmClusterResult {
  cluster_a: GmmCluster;
  cluster_b: GmmCluster;
  separation_score: number;
  bimodal_detected: boolean;
}

/** 감도 진단 */
export interface SensDiagnosis {
  current_behavior: 'overshoot_dominant' | 'undershoot_dominant' | 'balanced' | 'insufficient_data';
  consistency_score: number;
  recommended_adjustment: number;
  confidence: number;
  details: string;
}

/** 궤적 분석 통합 결과 */
export interface TrajectoryAnalysisResult {
  click_vectors: ClickVector[];
  gmm: GmmClusterResult | null;
  diagnosis: SensDiagnosis;
  total_clicks: number;
}

// ========== Style Transition (Day 18) ==========

/** 스타일 전환 DB 행 */
export interface StyleTransitionRow {
  id: number;
  profile_id: number;
  from_type: string;
  to_type: string;
  target_sens_range: string;
  started_at: string;
  current_phase: 'initial' | 'adaptation' | 'consolidation' | 'mastery';
  plateau_detected: boolean;
  completed_at: string | null;
}

/** 피처 수렴 상태 */
export interface FeatureConvergence {
  feature_name: string;
  convergence_pct: number;
  target_direction: 'up' | 'down';
}

/** 전환 진행 상태 */
export interface TransitionProgress {
  phase: string;
  convergence_pct: number;
  key_features_status: FeatureConvergence[];
  plateau_detected: boolean;
  estimated_days_remaining: number;
}

// ========== Progress Dashboard (Day 18) ==========

/** 일별 통계 행 */
export interface DailyStatRow {
  id: number;
  profile_id: number;
  stat_date: string;
  scenario_type: string;
  avg_score: number;
  max_score: number;
  sessions_count: number;
  total_trials: number;
  total_time_ms: number;
  avg_accuracy: number;
}

/** 스킬 진행도 행 */
export interface SkillProgressRow {
  id: number;
  profile_id: number;
  stage_type: string;
  rolling_avg_score: number;
  best_score: number;
  total_sessions: number;
  total_time_ms: number;
  last_updated: string;
}

// ========== Movement System (Day 20) ==========

/** 무브먼트 프리셋 — 게임별 이동 물리 파라미터 */
export interface MovementPreset {
  game_id: string;
  name: string;
  max_speed: number;
  stop_time: number;
  accel_type: string;
  air_control: number;
  cs_bonus: number;
}

/** 무브먼트 프로필 DB 행 */
export interface MovementProfileRow {
  id: number;
  game_id: number;
  name: string;
  max_speed: number;
  stop_time: number;
  accel_type: string;
  air_control: number;
  cs_bonus: number;
  is_custom: boolean;
}

/** 가중 감도 추천 결과 */
export interface WeightedRecommendation {
  static_optimal: number;
  moving_optimal: number;
  movement_ratio: number;
  final_cm360: number;
  delta_from_static: number;
  direction: string;
}

// ========== FOV Profile (Day 20) ==========

/** FOV 테스트 결과 DB 행 */
export interface FovProfileRow {
  id: number;
  profile_id: number;
  fov_tested: number;
  scenario_type: string;
  score: number;
  peripheral_score: number | null;
  center_score: number | null;
  created_at: string;
}

/** FOV별 비교 결과 */
export interface FovComparison {
  fov: number;
  avg_peripheral: number;
  avg_center: number;
  composite: number;
  peripheral_delta_pct: number;
  center_delta_pct: number;
}

/** FOV 추천 결과 */
export interface FovRecommendation {
  recommended_fov: number;
  reason: string;
  comparisons: FovComparison[];
  baseline_fov: number;
}

// ========== Hardware Comparison (Day 20) ==========

/** 하드웨어 콤보 DB 행 */
export interface HardwareComboRow {
  id: number;
  mouse_model: string;
  dpi: number;
  verified_dpi: number | null;
  polling_rate: number | null;
  mousepad_model: string | null;
  created_at: string;
}

/** DNA 피처 델타 (하드웨어 간) */
export interface DnaFeatureDelta {
  feature: string;
  value_a: number;
  value_b: number;
  delta_pct: number;
  status: 'improved' | 'degraded' | 'unchanged';
}

/** 하드웨어 비교 결과 */
export interface HardwareComparison {
  combo_a: HardwareComboRow;
  combo_b: HardwareComboRow;
  optimal_shift: number;
  shift_pct: number;
  shift_description: string;
  dna_deltas: DnaFeatureDelta[];
  improved_count: number;
  degraded_count: number;
  summary: string;
}
