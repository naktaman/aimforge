/**
 * 캘리브레이션 상태 스토어 (zustand)
 * GP Bayesian Optimization 캘리브레이션 플로우 관리
 */
import { create } from 'zustand';

/** 캘리브레이션 스테이지 */
export type CalibrationStage = 'screening' | 'calibration' | 'complete';

/** 캘리브레이션 모드 */
export type CalibrationMode = 'explore' | 'refine' | 'fixed';

/** 수렴 레벨 */
export type ConvergenceLevel = 'quick' | 'deep' | 'obsessive';

/** GP 곡선 포인트 */
export interface GpCurvePoint {
  x: number;
  mean: number;
  variance: number;
}

/** 관측 데이터 포인트 */
export interface ObservationPoint {
  cm360: number;
  score: number;
}

/** 이봉 피크 */
export interface Peak {
  cm360: number;
  score: number;
  variance: number;
  isPrimary: boolean;
}

/** 유의성 검정 결과 */
export interface SignificanceResult {
  zScore: number;
  pValue: number;
  label: 'Recommend' | 'Marginal' | 'Keep';
}

/** 캘리브레이션 최종 결과 */
export interface CalibrationResult {
  recommendedCm360: number;
  recommendedScore: number;
  currentCm360: number;
  peaks: Peak[];
  bimodalDetected: boolean;
  significance: SignificanceResult;
  partialDna: {
    wristArmRatio: number;
    avgOvershoot: number;
    preAimRatio: number;
    directionBias: number;
    trackingSmoothness: number | null;
  } | null;
  adaptationRate: number | null;
  totalIterations: number;
  gpCurve: [number, number, number][];
  observations: [number, number][];
}

interface CalibrationState {
  /** 캘리브레이션 진행 중 여부 */
  isCalibrating: boolean;
  /** 현재 스테이지 */
  stage: CalibrationStage | null;
  /** 캘리브레이션 모드 */
  mode: CalibrationMode;
  /** 수렴 레벨 */
  convergenceLevel: ConvergenceLevel;
  /** 현재 반복 */
  iteration: number;
  /** 최대 반복 */
  maxIterations: number;
  /** 다음 테스트 cm/360 */
  nextCm360: number | null;
  /** GP 예측 곡선 */
  gpCurve: GpCurvePoint[];
  /** 관측 데이터 */
  observations: ObservationPoint[];
  /** 현재 최적 */
  currentBest: { cm360: number; score: number } | null;
  /** 스크리닝 진행도 */
  screeningProgress: { current: number; target: number } | null;
  /** 최종 결과 */
  result: CalibrationResult | null;
  /** 피로 중단 */
  fatigueStopped: boolean;
  /** DB 세션 ID */
  sessionId: number | null;

  // Actions
  startCalibration: (mode: CalibrationMode, sessionId: number, convergenceLevel?: ConvergenceLevel) => void;
  setStage: (stage: CalibrationStage) => void;
  setNextCm360: (cm360: number) => void;
  updateStatus: (status: {
    stage: string;
    iteration: number;
    maxIterations: number;
    screeningProgress: [number, number] | null;
    currentBest: [number, number] | null;
    gpCurve: [number, number, number][];
    observations: [number, number][];
  }) => void;
  setResult: (result: CalibrationResult) => void;
  setFatigueStopped: () => void;
  resetCalibration: () => void;
}

export const useCalibrationStore = create<CalibrationState>((set) => ({
  isCalibrating: false,
  stage: null,
  mode: 'explore',
  convergenceLevel: 'quick',
  iteration: 0,
  maxIterations: 15,
  nextCm360: null,
  gpCurve: [],
  observations: [],
  currentBest: null,
  screeningProgress: null,
  result: null,
  fatigueStopped: false,
  sessionId: null,

  startCalibration: (mode, sessionId, convergenceLevel = 'quick') =>
    set({
      isCalibrating: true,
      stage: 'screening',
      mode,
      convergenceLevel,
      iteration: 0,
      nextCm360: null,
      gpCurve: [],
      observations: [],
      currentBest: null,
      screeningProgress: null,
      result: null,
      fatigueStopped: false,
      sessionId,
    }),

  setStage: (stage) => set({ stage }),

  setNextCm360: (cm360) => set({ nextCm360: cm360 }),

  updateStatus: (status) =>
    set({
      stage: status.stage as CalibrationStage,
      iteration: status.iteration,
      maxIterations: status.maxIterations,
      screeningProgress: status.screeningProgress
        ? { current: status.screeningProgress[0], target: status.screeningProgress[1] }
        : null,
      currentBest: status.currentBest
        ? { cm360: status.currentBest[0], score: status.currentBest[1] }
        : null,
      gpCurve: status.gpCurve.map(([x, mean, variance]) => ({ x, mean, variance })),
      observations: status.observations.map(([cm360, score]) => ({ cm360, score })),
    }),

  setResult: (result) =>
    set({
      result,
      isCalibrating: false,
      stage: 'complete',
    }),

  setFatigueStopped: () =>
    set({
      fatigueStopped: true,
      isCalibrating: false,
    }),

  resetCalibration: () =>
    set({
      isCalibrating: false,
      stage: null,
      mode: 'explore',
      convergenceLevel: 'quick',
      iteration: 0,
      maxIterations: 15,
      nextCm360: null,
      gpCurve: [],
      observations: [],
      currentBest: null,
      screeningProgress: null,
      result: null,
      fatigueStopped: false,
      sessionId: null,
    }),
}));
