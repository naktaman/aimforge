/**
 * 하드웨어/FOV/Movement 관련 타입
 */

// ========== Movement System ==========

/** 무브먼트 프리셋 */
export interface MovementPreset {
  gameId: string;
  name: string;
  maxSpeed: number;
  stopTime: number;
  accelType: string;
  airControl: number;
  csBonus: number;
}

/** 무브먼트 프로필 DB 행 */
export interface MovementProfileRow {
  id: number;
  gameId: number;
  name: string;
  maxSpeed: number;
  stopTime: number;
  accelType: string;
  airControl: number;
  csBonus: number;
  isCustom: boolean;
}

/** 가중 감도 추천 결과 */
export interface WeightedRecommendation {
  staticOptimal: number;
  movingOptimal: number;
  movementRatio: number;
  finalCm360: number;
  deltaFromStatic: number;
  direction: string;
}

// ========== FOV Profile ==========

/** FOV 테스트 결과 DB 행 */
export interface FovProfileRow {
  id: number;
  profileId: number;
  fovTested: number;
  scenarioType: string;
  score: number;
  peripheralScore: number | null;
  centerScore: number | null;
  createdAt: string;
}

/** FOV별 비교 결과 */
export interface FovComparison {
  fov: number;
  avgPeripheral: number;
  avgCenter: number;
  composite: number;
  peripheralDeltaPct: number;
  centerDeltaPct: number;
}

/** FOV 추천 결과 */
export interface FovRecommendation {
  recommendedFov: number;
  reason: string;
  comparisons: FovComparison[];
  baselineFov: number;
}

// ========== Hardware Comparison ==========

/** 하드웨어 콤보 DB 행 */
export interface HardwareComboRow {
  id: number;
  mouseModel: string;
  dpi: number;
  verifiedDpi: number | null;
  pollingRate: number | null;
  mousepadModel: string | null;
  createdAt: string;
}

/** DNA 피처 델타 (하드웨어 간) */
export interface DnaFeatureDelta {
  feature: string;
  valueA: number;
  valueB: number;
  deltaPct: number;
  status: 'improved' | 'degraded' | 'unchanged';
}

/** 하드웨어 비교 결과 */
export interface HardwareComparison {
  comboA: HardwareComboRow;
  comboB: HardwareComboRow;
  optimalShift: number;
  shiftPct: number;
  shiftDescription: string;
  dnaDeltas: DnaFeatureDelta[];
  improvedCount: number;
  degradedCount: number;
  summary: string;
}
