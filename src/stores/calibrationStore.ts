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
  is_primary: boolean;
}

/** 유의성 검정 결과 */
export interface SignificanceResult {
  z_score: number;
  p_value: number;
  label: 'Recommend' | 'Marginal' | 'Keep';
}

/** 캘리브레이션 최종 결과 */
export interface CalibrationResult {
  recommended_cm360: number;
  recommended_score: number;
  current_cm360: number;
  peaks: Peak[];
  bimodal_detected: boolean;
  significance: SignificanceResult;
  partial_dna: {
    wrist_arm_ratio: number;
    avg_overshoot: number;
    pre_aim_ratio: number;
    direction_bias: number;
    tracking_smoothness: number | null;
  } | null;
  adaptation_rate: number | null;
  total_iterations: number;
  gp_curve: [number, number, number][];
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
    max_iterations: number;
    screening_progress: [number, number] | null;
    current_best: [number, number] | null;
    gp_curve: [number, number, number][];
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
      maxIterations: status.max_iterations,
      screeningProgress: status.screening_progress
        ? { current: status.screening_progress[0], target: status.screening_progress[1] }
        : null,
      currentBest: status.current_best
        ? { cm360: status.current_best[0], score: status.current_best[1] }
        : null,
      gpCurve: status.gp_curve.map(([x, mean, variance]) => ({ x, mean, variance })),
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
