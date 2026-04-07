/**
 * 훈련 시스템 타입 — 처방, Readiness, Style Transition, 스테이지
 */
// 도메인별 분리 — core 타입은 직접 정의

// ========== Training Stage 시스템 ==========

/** 훈련 스테이지 카테고리 */
export type StageCategory =
  | 'flick'
  | 'tracking'
  | 'switching'
  | 'assessment'
  | 'flick_shot'
  | 'target_switching'
  | 'close_range'
  | 'long_range';

/** 9개 핵심 세분류 + 레거시 호환 타입 */
export type StageType =
  | 'flick_micro' | 'flick_medium' | 'flick_macro'
  | 'tracking_close' | 'tracking_mid' | 'tracking_long'
  | 'switching_close' | 'switching_wide'
  | 'aim_dna_scan'
  | 'static_flick' | 'reaction_flick' | 'scoped_flick'
  | 'horizontal_tracking' | 'aerial_tracking' | 'circular_tracking'
  | 'multi_flick' | 'zoom_multi_flick' | 'close_range_180'
  | 'jump_tracking' | 'strafe_tracking'
  | 'long_range_precision' | 'bulletdrop_sniping' | 'custom_drill';

/** 트래킹 이동 패턴 */
export type MovementPattern =
  | 'linear' | 'parabolic' | 'jitter' | 'acceleration' | 'mixed';

/** 이동 패턴별 설정 */
export interface MovementPatternConfig {
  pattern: MovementPattern;
  baseSpeedDegPerSec: number;
  directionChangeFreq?: number;
  accelMultiplier?: number;
  arcAmplitudeDeg?: number;
}

/** 트래킹 세분류 시나리오 설정 */
export interface TrackingStageConfig {
  stageType: 'tracking_close' | 'tracking_mid' | 'tracking_long';
  difficulty: DifficultyConfig;
  distance: number;
  patterns: MovementPatternConfig[];
  durationMs: number;
}

/** 플릭 세분류 시나리오 설정 */
export interface FlickStageConfig {
  stageType: 'flick_micro' | 'flick_medium' | 'flick_macro';
  difficulty: DifficultyConfig;
  angleRange: [number, number];
  numTargets: number;
  timeoutMs: number;
}

/** 스위칭 세분류 시나리오 설정 */
export interface SwitchingStageConfig {
  stageType: 'switching_close' | 'switching_wide';
  difficulty: DifficultyConfig;
  separationRange: [number, number];
  waveCount: number;
  targetsPerWave: number;
}

/** 세분류 시나리오 결과 */
export interface SubCategoryResult {
  stageType: StageType;
  category: StageCategory;
  score: number;
  accuracy: number;
  avgTttMs?: number;
  avgOvershootDeg?: number;
  trackingMad?: number;
  patternScores?: Record<MovementPattern, number>;
  avgSwitchTimeMs?: number;
  rawMetrics: string;
}

/** 스테이지 메타데이터 */
export interface StageMeta {
  type: StageType;
  category: StageCategory;
  name: string;
  description: string;
  icon: string;
  hasBenchmark: boolean;
}

/** 난이도 설정 */
export interface DifficultyConfig {
  mode: 'benchmark' | 'manual' | 'adaptive';
  targetSizeDeg: number;
  targetSpeedDegPerSec: number;
  reactionWindowMs: number;
  targetCount: number;
  adaptiveTargetSuccessRate: number;
}

/** 발사 모드 */
export type FireMode = 'single' | 'burst' | 'auto' | 'bolt';

/** 반동 유형 */
export type RecoilType = 'none' | 'fixed' | 'valorant' | 'bloom';

/** 무기 카테고리 */
export type WeaponCategory = 'pistol' | 'smg' | 'rifle' | 'sniper' | 'custom';

/** 무기 설정 — 기존 필드 유지 + Phase 1 확장 */
export interface WeaponConfig {
  // ── 기존 필드 (하위 호환) ──
  fireRateRpm: number;
  recoilPattern: Array<[number, number]>;
  recoilResetMs: number;
  zoomMultiplier: number;
  zoomFov: number;
  zoomSensMultiplier: number;
  bulletDropEnabled: boolean;
  bulletDropGravity: number;
  bulletVelocity: number;

  // ── Phase 1 확장 (모두 optional — 기존 프리셋 호환) ──

  /** 무기 식별자 */
  id?: string;
  /** 표시 이름 */
  name?: string;
  /** 카테고리 */
  category?: WeaponCategory;

  /** 발사 모드 (기본: auto — fireRateRpm > 0이면 auto, 아니면 single) */
  fireMode?: FireMode;
  /** 버스트 발수 (burst 모드 전용, 기본: 3) */
  burstCount?: number;
  /** 버스트 내부 RPM (버스트 간격과 별도, 기본: fireRateRpm) */
  burstInternalRpm?: number;

  /** 탄창 크기 (0 = 무제한, 기본: 0) */
  magazineSize?: number;
  /** 리로드 시간 (ms, 기본: 2000) */
  reloadTimeMs?: number;

  /** 첫발 정확도 (도, 기본: 0) */
  firstShotAccuracy?: number;
  /** 기본 스프레드 (도, 기본: 0) */
  baseSpread?: number;

  /** 반동 유형 (기본: fixed — recoilPattern 있으면 fixed, 없으면 none) */
  recoilType?: RecoilType;
  /** 수직 반동 강도 — 도/발 (bloom 타입용, 기본: 0) */
  verticalRecoilStrength?: number;
  /** 수평 반동 강도 — 도/발 (bloom 타입용, 기본: 0) */
  horizontalRecoilStrength?: number;
  /** 반동 랜덤 편차 σ (기본: 0.2) */
  recoilRandomDeviation?: number;

  /** 블룸 증가율 — 도/발 (bloom 타입 전용) */
  bloomPerShot?: number;
  /** 블룸 최대치 (도) */
  bloomMax?: number;
  /** 블룸 회복율 — 도/초 */
  bloomRecoveryRate?: number;

  /** 뷰모델 스타일 힌트 */
  viewmodelStyle?: 'pistol' | 'rifle';
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

/** 스테이지 추천 */
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

// ========== Training Prescription ==========

/** 훈련 처방 항목 */
export interface TrainingPrescription {
  weakness: string;
  scenarioType: string;
  scenarioParams: Record<string, unknown>;
  priority: number;
  estimatedMin: number;
  sourceType: 'single_game' | 'cross_game';
  description: string;
}

// ========== Game Readiness ==========

/** Readiness 측정 입력 */
export interface ReadinessInput {
  profileId: number;
  flickAccuracy: number;
  flickAvgTttMs: number;
  flickAvgOvershoot: number;
  trackingMad: number;
  trackingVelocityMatch: number;
}

/** Readiness 결과 */
export interface ReadinessResult {
  score: number;
  baselineDelta: BaselineDelta;
  dailyAdvice: string;
  category: 'peak' | 'ready' | 'moderate' | 'rest';
}

/** Baseline 대비 변화율 */
export interface BaselineDelta {
  flickAccuracyPct: number;
  tttPct: number;
  overshootPct: number;
  trackingMadPct: number;
  velocityMatchPct: number;
}

/** Readiness Score DB 행 */
export interface ReadinessScoreRow {
  id: number;
  profileId: number;
  score: number;
  baselineDelta: string;
  dailyAdvice: string | null;
  measuredAt: string;
}

// ========== Style Transition ==========

/** 스타일 전환 DB 행 */
export interface StyleTransitionRow {
  id: number;
  profileId: number;
  fromType: string;
  toType: string;
  targetSensRange: string;
  startedAt: string;
  currentPhase: 'initial' | 'adaptation' | 'consolidation' | 'mastery';
  plateauDetected: boolean;
  completedAt: string | null;
}

/** 피처 수렴 상태 */
export interface FeatureConvergence {
  featureName: string;
  convergencePct: number;
  targetDirection: 'up' | 'down';
}

/** 전환 진행 상태 */
export interface TransitionProgress {
  phase: string;
  convergencePct: number;
  keyFeaturesStatus: FeatureConvergence[];
  plateauDetected: boolean;
  estimatedDaysRemaining: number;
}

// ========== Trajectory Analysis ==========

/** 클릭 벡터 */
export interface ClickVector {
  dxDeg: number;
  dyDeg: number;
  magnitudeDeg: number;
  durationMs: number;
  peakVelocity: number;
  endVelocity: number;
  overshoot: boolean;
  motorRegion: 'finger' | 'wrist' | 'arm';
  hit: boolean;
}

/** GMM 단일 클러스터 */
export interface GmmCluster {
  mean: number;
  stdDev: number;
  weight: number;
  sampleCount: number;
}

/** GMM 2-컴포넌트 결과 */
export interface GmmClusterResult {
  clusterA: GmmCluster;
  clusterB: GmmCluster;
  separationScore: number;
  bimodalDetected: boolean;
}

/** 감도 진단 */
export interface SensDiagnosis {
  currentBehavior: 'overshoot_dominant' | 'undershoot_dominant' | 'balanced' | 'insufficient_data';
  consistencyScore: number;
  recommendedAdjustment: number;
  confidence: number;
  details: string;
}

/** 궤적 분석 통합 결과 */
export interface TrajectoryAnalysisResult {
  clickVectors: ClickVector[];
  gmm: GmmClusterResult | null;
  diagnosis: SensDiagnosis;
  totalClicks: number;
}

// ========== Progress Dashboard ==========

/** 일별 통계 행 */
export interface DailyStatRow {
  id: number;
  profileId: number;
  statDate: string;
  scenarioType: string;
  avgScore: number;
  maxScore: number;
  sessionsCount: number;
  totalTrials: number;
  totalTimeMs: number;
  avgAccuracy: number;
}

/** 스킬 진행도 행 */
export interface SkillProgressRow {
  id: number;
  profileId: number;
  stageType: string;
  rollingAvgScore: number;
  bestScore: number;
  totalSessions: number;
  totalTimeMs: number;
  lastUpdated: string;
}
