/**
 * 줌 캘리브레이션 상태 스토어 (zustand)
 * 멀티 배율 GP 캘리브레이션 + K 피팅 + 비교기 플로우 관리
 */
import { create } from 'zustand';

/** 줌 페이즈 */
export type ZoomPhase = 'steady' | 'correction' | 'zoomout';

/** 줌 프로파일 (DB에서 로드) */
export interface ZoomProfile {
  id: number;
  game_id: number;
  scope_name: string;
  zoom_ratio: number;
  fov_override: number | null;
  steady_weight: number;
  transition_weight: number;
  zoomout_weight: number;
}

/** 비율별 상태 */
export interface RatioStatus {
  scopeName: string;
  zoomRatio: number;
  completed: boolean;
  iteration: number;
  bestMultiplier: number | null;
  bestScore: number | null;
}

/** K 피팅 결과 */
export interface KFitResult {
  k_value: number;
  k_variance: number;
  quality: 'Low' | 'Medium' | 'High';
  data_points: { zoom_ratio: number; scope_fov: number; optimal_multiplier: number; score: number }[];
  piecewise_k: { ratio_start: number; ratio_end: number; k: number }[] | null;
}

/** 예측 배율 */
export interface PredictedMultiplier {
  scope_name: string;
  zoom_ratio: number;
  multiplier: number;
  is_measured: boolean;
}

/** 방식별 점수 */
export interface MethodScore {
  method: string;
  /** 해당 방식에 사용된 배율 */
  multiplier_used: number;
  steady_mean: number;
  correction_mean: number;
  zoomout_mean: number;
  composite_mean: number;
  composite_std: number;
  p_value: number | null;
  effect_size: number | null;
  rank: number;
  is_recommended: boolean;
}

/** 비교기 상태 */
export interface ComparatorState {
  isRunning: boolean;
  currentTrial: number;
  totalTrials: number;
  currentMethod: string | null;
}

/** 비교기 결과 */
export interface ComparatorResult {
  method_scores: MethodScore[];
  recommended_method: string;
  summary: string;
}

interface ZoomCalibrationState {
  /** 줌 캘리브레이션 진행 중 */
  isCalibrating: boolean;
  /** 사용 가능한 줌 프로파일 */
  availableProfiles: ZoomProfile[];
  /** AI 추천 프로파일 인덱스 */
  recommendedIndices: number[];
  /** 선택된 프로파일 ID */
  selectedProfileIds: number[];
  /** 현재 비율 인덱스 */
  currentRatioIndex: number;
  /** 전체 비율 수 */
  totalRatios: number;
  /** 현재 페이즈 */
  currentPhase: ZoomPhase;
  /** 비율별 상태 */
  ratioStatuses: RatioStatus[];
  /** K 피팅 결과 */
  kFitResult: KFitResult | null;
  /** 전체 배율 예측 */
  predictedMultipliers: PredictedMultiplier[];
  /** 비교기 상태 */
  comparatorState: ComparatorState | null;
  /** 비교기 결과 */
  comparatorResult: ComparatorResult | null;
  /** 수렴 모드 */
  convergenceMode: 'quick' | 'deep' | 'obsessive';

  // Actions
  setAvailableProfiles: (profiles: ZoomProfile[]) => void;
  setRecommendedIndices: (indices: number[]) => void;
  setSelectedProfileIds: (ids: number[]) => void;
  setConvergenceMode: (mode: 'quick' | 'deep' | 'obsessive') => void;
  startZoomCalibration: (ratioStatuses: RatioStatus[]) => void;
  updateRatioProgress: (ratioIndex: number, iteration: number, bestMult: number | null, bestScore: number | null) => void;
  completeRatio: (ratioIndex: number) => void;
  advanceToNextRatio: () => void;
  setCurrentPhase: (phase: ZoomPhase) => void;
  setKFitResult: (result: KFitResult) => void;
  setPredictedMultipliers: (predictions: PredictedMultiplier[]) => void;
  startComparator: (totalTrials: number) => void;
  updateComparator: (trial: number, method: string) => void;
  setComparatorResult: (result: ComparatorResult) => void;
  resetZoomCalibration: () => void;
}

export const useZoomCalibrationStore = create<ZoomCalibrationState>((set) => ({
  isCalibrating: false,
  availableProfiles: [],
  recommendedIndices: [],
  selectedProfileIds: [],
  currentRatioIndex: 0,
  totalRatios: 0,
  currentPhase: 'steady',
  ratioStatuses: [],
  kFitResult: null,
  predictedMultipliers: [],
  comparatorState: null,
  comparatorResult: null,
  convergenceMode: 'quick',

  setAvailableProfiles: (profiles) => set({ availableProfiles: profiles }),
  setRecommendedIndices: (indices) => set({ recommendedIndices: indices }),
  setSelectedProfileIds: (ids) => set({ selectedProfileIds: ids }),
  setConvergenceMode: (mode) => set({ convergenceMode: mode }),

  startZoomCalibration: (ratioStatuses) =>
    set({
      isCalibrating: true,
      currentRatioIndex: 0,
      totalRatios: ratioStatuses.length,
      currentPhase: 'steady',
      ratioStatuses,
      kFitResult: null,
      predictedMultipliers: [],
      comparatorState: null,
      comparatorResult: null,
    }),

  updateRatioProgress: (ratioIndex, iteration, bestMult, bestScore) =>
    set((state) => {
      const updated = [...state.ratioStatuses];
      if (updated[ratioIndex]) {
        updated[ratioIndex] = {
          ...updated[ratioIndex],
          iteration,
          bestMultiplier: bestMult,
          bestScore: bestScore,
        };
      }
      return { ratioStatuses: updated };
    }),

  completeRatio: (ratioIndex) =>
    set((state) => {
      const updated = [...state.ratioStatuses];
      if (updated[ratioIndex]) {
        updated[ratioIndex] = { ...updated[ratioIndex], completed: true };
      }
      return { ratioStatuses: updated };
    }),

  advanceToNextRatio: () =>
    set((state) => ({
      currentRatioIndex: state.currentRatioIndex + 1,
      currentPhase: 'steady',
    })),

  setCurrentPhase: (phase) => set({ currentPhase: phase }),

  setKFitResult: (result) => set({ kFitResult: result }),
  setPredictedMultipliers: (predictions) => set({ predictedMultipliers: predictions }),

  startComparator: (totalTrials) =>
    set({
      comparatorState: {
        isRunning: true,
        currentTrial: 0,
        totalTrials,
        currentMethod: null,
      },
    }),

  updateComparator: (trial, method) =>
    set((state) => ({
      comparatorState: state.comparatorState
        ? { ...state.comparatorState, currentTrial: trial, currentMethod: method }
        : null,
    })),

  setComparatorResult: (result) =>
    set({
      comparatorResult: result,
      comparatorState: null,
    }),

  resetZoomCalibration: () =>
    set({
      isCalibrating: false,
      availableProfiles: [],
      recommendedIndices: [],
      selectedProfileIds: [],
      currentRatioIndex: 0,
      totalRatios: 0,
      currentPhase: 'steady',
      ratioStatuses: [],
      kFitResult: null,
      predictedMultipliers: [],
      comparatorState: null,
      comparatorResult: null,
      convergenceMode: 'quick',
    }),
}));
