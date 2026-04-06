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

// ── 캘리브레이션 IPC 응답 타입 ──────────────────────────────────

/** 다음 트라이얼 지시 (get_next_trial_sens 응답) */
export interface NextTrialAction {
  cm360: number;
  stage: 'screening' | 'calibration' | 'complete';
  iteration: number;
  isBaseline: boolean;
}

/** 트라이얼 제출 피드백 (submit_calibration_trial 응답) */
export interface TrialFeedback {
  converged: boolean;
  fatigueStop: boolean;
  stageTransition: boolean;
  currentBestCm360: number | null;
  currentBestScore: number | null;
  message: string | null;
}

/** 캘리브레이션 상태 (get_calibration_status 응답) */
export interface CalibrationStatusResponse {
  stage: 'screening' | 'calibration' | 'complete';
  mode: 'explore' | 'refine' | 'fixed';
  iteration: number;
  maxIterations: number;
  screeningProgress: [number, number] | null;
  currentBest: [number, number] | null;
  gpCurve: [number, number, number][];
  observations: [number, number][];
}

// ── 줌 캘리브레이션 IPC 응답 타입 ──────────────────────────────

/** 다음 줌 트라이얼 지시 (get_next_zoom_trial 응답) */
export interface ZoomTrialAction {
  ratioIndex: number;
  ratio: number;
  scopeName: string;
  multiplier: number;
  phase: 'steady' | 'correction' | 'zoomout';
  iteration: number;
  isBaseline: boolean;
}

/** 줌 트라이얼 피드백 (submit_zoom_trial 응답) */
export interface ZoomTrialFeedback {
  ratioConverged: boolean;
  advanceToNextRatio: boolean;
  allComplete: boolean;
  fatigueStop: boolean;
  currentBestMultiplier: number | null;
  currentBestScore: number | null;
}

/** 줌 캘리브레이션 최종 결과 (finalize_zoom_calibration 응답) */
export interface ZoomCalibrationResultResponse {
  ratioResults: ZoomRatioResultItem[];
  kFit: ZoomKFitResult;
  predictedMultipliers: ZoomPredictedMultiplier[];
  totalIterations: number;
}

/** 줌 비율별 결과 */
export interface ZoomRatioResultItem {
  zoomProfileId: number;
  ratio: number;
  scopeFov: number;
  optimalMultiplier: number;
  steadyScore: number;
  correctionScore: number;
  zoomoutScore: number;
  compositeScore: number;
  mdmPredicted: number;
  deviation: number;
  observations: [number, number][];
}

/** K 피팅 결과 (Rust → TS) */
export interface ZoomKFitResult {
  kValue: number;
  kVariance: number;
  quality: 'low' | 'medium' | 'high';
  dataPoints: { zoomRatio: number; scopeFov: number; optimalMultiplier: number; score: number }[];
  piecewiseK: { ratioStart: number; ratioEnd: number; k: number }[] | null;
  aimType: string | null;
}

/** 예측 배율 (Rust → TS) */
export interface ZoomPredictedMultiplier {
  scopeName: string;
  zoomRatio: number;
  multiplier: number;
  isMeasured: boolean;
}

/** K 조정 결과 (adjust_k 응답) */
export interface AdjustedPredictions {
  kValue: number;
  predictions: ZoomPredictedMultiplier[];
}

// ── Comparator IPC 응답 타입 ────────────────────────────────────

/** Comparator 트라이얼 지시 (get_next_comparator_trial 응답) */
export interface ComparatorTrialAction {
  method: string;
  methodIndex: number;
  repetition: number;
  trialNumber: number;
  totalTrials: number;
  multiplier: number;
}

/** Comparator 트라이얼 피드백 (submit_comparator_trial 응답) */
export interface ComparatorTrialFeedbackResponse {
  hasNext: boolean;
  completed: number;
  total: number;
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
