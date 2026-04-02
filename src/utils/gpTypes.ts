/**
 * GP(Gaussian Process) 시각화 관련 타입 정의
 * Rust CalibrationStatus / CalibrationResult와 대응
 */

/** GP 곡선 포인트 (x: cm/360, mean: 예측 평균, variance: 분산) */
export interface GPCurvePoint {
  x: number;
  mean: number;
  variance: number;
}

/** 관측 데이터 포인트 */
export interface Observation {
  cm360: number;
  score: number;
  /** 최신 관측인지 여부 (UI 강조용) */
  isLatest?: boolean;
}

/** 수렴 모드 */
export type ConvergenceModeType = 'quick' | 'deep' | 'obsessive';

/** 수렴 모드별 설정 */
export const CONVERGENCE_MODE_CONFIG: Record<ConvergenceModeType, {
  label: string;
  expectedRounds: [number, number];
  maxIterations: number;
}> = {
  quick: { label: 'Quick', expectedRounds: [5, 8], maxIterations: 15 },
  deep: { label: 'Deep', expectedRounds: [10, 15], maxIterations: 25 },
  obsessive: { label: 'Obsessive', expectedRounds: [20, 30], maxIterations: 40 },
};

/** EI 추천점 */
export interface EIRecommendation {
  cm360: number;
  ei: number;
}

/** 캘리브레이션 스테이지 */
export type CalibrationStage = 'Screening' | 'Calibration' | 'Complete';

/** 캘리브레이션 상태 (Rust CalibrationStatus 대응) */
export interface CalibrationStatusData {
  stage: CalibrationStage;
  mode: string;
  iteration: number;
  maxIterations: number;
  screeningProgress: [number, number] | null;
  currentBest: [number, number] | null;
  gpCurve: [number, number, number][];
  observations: [number, number][];
}

/** 최종 결과 (Rust CalibrationResult 대응) */
export interface CalibrationResultData {
  recommendedCm360: number;
  recommendedScore: number;
  currentCm360: number;
  peaks: { cm360: number; score: number; variance: number }[];
  bimodalDetected: boolean;
  significance: {
    zScore: number;
    pValue: number;
    significant: boolean;
    effectSize: string;
  };
  totalIterations: number;
  gpCurve: [number, number, number][];
  observations: [number, number][];
}

/** 감도 변환 항목 (게임별) */
export interface GameSensConversion {
  gameName: string;
  sensitivity: number;
  unit: string;
}
