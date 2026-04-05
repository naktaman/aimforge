/**
 * Aim DNA 관련 타입
 */

/** 완성된 Aim DNA 프로파일 (Rust AimDnaProfile 대응) */
export interface AimDnaProfile {
  profileId: number;
  sessionId: number;
  flickPeakVelocity: number | null;
  overshootAvg: number | null;
  directionBias: number | null;
  effectiveRange: number | null;
  trackingMad: number | null;
  phaseLag: number | null;
  smoothness: number | null;
  velocityMatch: number | null;
  microFreq: number | null;
  wristArmRatio: number | null;
  fittsA: number | null;
  fittsB: number | null;
  fatigueDecay: number | null;
  preAimRatio: number | null;
  preFireRatio: number | null;
  sensAttributedOvershoot: number | null;
  vHRatio: number | null;
  fingerAccuracy: number | null;
  wristAccuracy: number | null;
  armAccuracy: number | null;
  motorTransitionAngle: number | null;
  typeLabel: string | null;
  dataSufficiency?: Record<string, FeatureSufficiency>;
}

/** 피처별 데이터 충족 상태 */
export interface FeatureSufficiency {
  sufficient: boolean;
  currentCount: number;
  requiredCount: number;
}

/** DNA 추세 분석 결과 */
export interface DnaTrendResult {
  profileId: number;
  recalibrationRecommended: boolean;
  changedFeatures: FeatureTrendChange[];
  stableFeatureCount: number;
  sessionsAnalyzed: number;
}

/** 피처별 추세 변화 */
export interface FeatureTrendChange {
  feature: string;
  priorAvg: number;
  recentAvg: number;
  changePct: number;
  direction: string;
}

/** 레퍼런스 게임 감지 결과 */
export interface ReferenceGameResult {
  referenceProfileId: number | null;
  scores: Array<[number, number]>;
}

/** Aim DNA 히스토리 항목 */
export interface AimDnaHistoryEntry {
  featureName: string;
  value: number;
  measuredAt: string;
}

/** DNA 시계열 스냅샷 */
export interface DnaSnapshot {
  id: number;
  profileId: number;
  aimDnaId: number;
  flickPower: number;
  trackingPrecision: number;
  motorControl: number;
  speed: number;
  consistency: number;
  typeLabel: string | null;
  cm360Sensitivity: number | null;
  measuredAt: string;
}

/** 변경점 이벤트 — 기어/감도/그립/자세 변경 시 기록 */
export interface DnaChangeEvent {
  id: number;
  profileId: number;
  changeType: 'gear' | 'sensitivity' | 'grip' | 'posture';
  beforeValue: string | null;
  afterValue: string;
  description: string;
  occurredAt: string;
}

/** 단일 축 변화 */
export interface AxisDelta {
  axis: string;
  beforeVal: number;
  afterVal: number;
  deltaAbs: number;
  deltaPct: number;
  direction: 'improved' | 'degraded' | 'stable';
}

/** 두 스냅샷 비교 결과 */
export interface SnapshotComparison {
  before: DnaSnapshot;
  after: DnaSnapshot;
  deltas: AxisDelta[];
  insights: string[];
}

/** 정체기 감지 결과 */
export interface StagnationResult {
  profileId: number;
  stagnantAxes: string[];
  isStagnant: boolean;
  suggestions: string[];
}
