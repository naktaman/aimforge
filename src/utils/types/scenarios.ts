/**
 * 시나리오 설정 + 결과 메트릭 타입
 */
import type {
  ScenarioConfig,
  Direction,
  MotorRegion,
  ClickType,
  TrajectoryType,
  HitZone,
  ScenarioType,
} from './core';

/** 각도 구간 버킷 */
export const ANGLE_BUCKETS = [10, 30, 60, 90, 120, 150, 180] as const;

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

/** Circular Tracking 시나리오 설정 */
export interface CircularTrackingConfig extends ScenarioConfig {
  type: 'circular_tracking';
  orbitRadiusDeg: number;
  orbitSpeedDegPerSec: number;
  radiusVariation: number;
  speedVariation: number;
  duration: number;
  distance: number;
}

/** Stochastic Tracking 시나리오 설정 */
export interface StochasticTrackingConfig extends ScenarioConfig {
  type: 'stochastic_tracking';
  noiseSpeed: number;
  amplitudeDeg: number;
  duration: number;
  distance: number;
}

/** Counter-Strafe Flick 시나리오 설정 */
export interface CounterStrafeFlickConfig extends ScenarioConfig {
  type: 'counter_strafe_flick';
  stopTimeMs: number;
  strafeSpeedDegPerSec: number;
  numTargets: number;
  angleRange: [number, number];
  timeout: number;
}

/** Micro-Flick 하이브리드 시나리오 설정 */
export interface MicroFlickConfig extends ScenarioConfig {
  type: 'micro_flick';
  switchFrequencyHz: number;
  trackingSpeedDegPerSec: number;
  flickAngleRange: [number, number];
  duration: number;
  distance: number;
}

/** 줌 티어 (배율 단계) */
export type ZoomTier = '1x' | '2x' | '4x' | '6x' | '8x' | '10x' | '12x';

/** Zoom Phase 공통 설정 */
export interface ZoomPhaseConfig extends ScenarioConfig {
  type: 'zoom_steady' | 'zoom_correction' | 'zoom_reacquisition';
  hipfireFov: number;
  scopeFov: number;
  scopeMultiplier: number;
  zoomTier: ZoomTier;
  distance: number;
  duration: number;
  numTargets: number;
}

/** Zoom Composite Runner 설정 */
export interface ZoomCompositeConfig {
  type: 'zoom_composite';
  steady: ZoomPhaseConfig;
  correction: ZoomPhaseConfig;
  reacquisition: ZoomPhaseConfig;
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

/** 히트 결과 */
export interface HitResult {
  hit: boolean;
  angularError: number;
  targetId: string;
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

/** Tracking 트라이얼 메트릭 */
export interface TrackingTrialMetrics {
  mad: number;
  deviationVariance: number;
  phaseLag: number;
  velocityMatchRatio: number;
  trajectoryType: TrajectoryType;
}

/** Zoom 복합 결과 */
export interface ZoomTrialMetrics {
  steadyScore: number;
  correctionScore: number;
  reacquisitionScore: number;
  compositeScore: number;
  zoomTier: ZoomTier;
  overCorrectionRatio: number;
  underCorrectionRatio: number;
}

/** Zoom Correction 개별 타겟 결과 */
export interface ZoomCorrectionResult {
  jumpOffset: number;
  correctionTime: number;
  overCorrected: boolean;
  underCorrected: boolean;
  settledError: number;
  hit: boolean;
}

/** Zoom Reacquisition 개별 타겟 결과 */
export interface ZoomReacquisitionResult {
  unzoomOffset: number;
  reacquisitionTime: number;
  reacquired: boolean;
}

/** MicroFlick 하이브리드 결과 */
export interface MicroFlickTrialMetrics {
  trackingMad: number;
  trackingVelocityMatch: number;
  flickHitRate: number;
  flickAvgTtt: number;
  avgReacquireTimeMs: number;
  compositeScore: number;
}

/** 배터리 프리셋 */
export type BatteryPreset = 'TACTICAL' | 'MOVEMENT' | 'BR' | 'CUSTOM';

/** 배터리 가중치 */
export interface BatteryWeights {
  flick: number;
  tracking: number;
  circularTracking: number;
  stochasticTracking: number;
  counterStrafeFlick: number;
  microFlick: number;
  zoomComposite: number;
}

/** 배터리 결과 */
export interface BatteryResult {
  preset: BatteryPreset;
  scores: Partial<Record<ScenarioType, number>>;
  weightedComposite: number;
  weights: BatteryWeights;
}
