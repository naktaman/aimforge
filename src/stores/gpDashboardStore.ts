/**
 * GP 감도 최적화 대시보드 상태 관리 (zustand)
 * CalibrationStatus를 프론트엔드 시각화에 맞게 가공
 */
import { create } from 'zustand';
import type {
  GPCurvePoint,
  Observation,
  ConvergenceModeType,
  EIRecommendation,
  CalibrationStage,
  CalibrationStatusData,
  CalibrationResultData,
  GameSensConversion,
} from '../utils/gpTypes';

/** 대시보드 뷰 상태 */
export type DashboardView = 'optimizing' | 'result';

interface GPDashboardState {
  /** 현재 뷰 */
  view: DashboardView;

  /** 수렴 모드 */
  convergenceMode: ConvergenceModeType;

  /** 캘리브레이션 스테이지 */
  stage: CalibrationStage;

  /** 현재 반복 / 최대 반복 */
  iteration: number;
  maxIterations: number;

  /** GP 곡선 데이터 */
  gpCurve: GPCurvePoint[];

  /** 관측 데이터 */
  observations: Observation[];

  /** 현재 최적 감도 */
  bestCm360: number | null;
  bestScore: number | null;

  /** 수렴 진행률 (0~1) */
  convergenceProgress: number;

  /** 초기 최대 σ (진행률 계산용) */
  initialMaxSigma: number | null;

  /** EI 추천점 */
  eiRecommendation: EIRecommendation | null;

  /** 최종 결과 */
  finalResult: CalibrationResultData | null;

  /** 게임별 감도 변환 */
  sensConversions: GameSensConversion[];

  // === Actions ===
  /** 수렴 모드 설정 */
  setConvergenceMode: (mode: ConvergenceModeType) => void;

  /** 캘리브레이션 상태 업데이트 (Rust CalibrationStatus → 프론트엔드) */
  updateFromStatus: (status: CalibrationStatusData) => void;

  /** 최종 결과 설정 */
  setFinalResult: (result: CalibrationResultData, conversions: GameSensConversion[]) => void;

  /** 목(mock) 데이터로 초기화 */
  loadMockData: () => void;

  /** 리셋 */
  reset: () => void;
}

/** CalibrationStatus 튜플 → 프론트엔드 타입으로 변환 */
function parseCurve(raw: [number, number, number][]): GPCurvePoint[] {
  return raw.map(([x, mean, variance]) => ({ x, mean, variance }));
}

function parseObservations(raw: [number, number][], prevCount: number): Observation[] {
  return raw.map(([ cm360, score ], i) => ({
    cm360,
    score,
    isLatest: i === raw.length - 1 && raw.length > prevCount,
  }));
}

/** 수렴 진행률 계산: 1 - (현재 최대 σ / 초기 최대 σ) */
function calcConvergenceProgress(
  curve: GPCurvePoint[],
  initialMaxSigma: number | null,
): { progress: number; initialSigma: number | null } {
  if (curve.length === 0) return { progress: 0, initialSigma: initialMaxSigma };
  const currentMaxSigma = Math.max(...curve.map(p => Math.sqrt(p.variance)));
  const initial = initialMaxSigma ?? currentMaxSigma;
  if (initial <= 0) return { progress: 1, initialSigma: initial };
  const progress = Math.max(0, Math.min(1, 1 - currentMaxSigma / initial));
  return { progress, initialSigma: initial };
}

export const useGPDashboardStore = create<GPDashboardState>((set, get) => ({
  view: 'optimizing',
  convergenceMode: 'quick',
  stage: 'Screening',
  iteration: 0,
  maxIterations: 15,
  gpCurve: [],
  observations: [],
  bestCm360: null,
  bestScore: null,
  convergenceProgress: 0,
  initialMaxSigma: null,
  eiRecommendation: null,
  finalResult: null,
  sensConversions: [],

  setConvergenceMode: (mode) => set({ convergenceMode: mode }),

  updateFromStatus: (status) => {
    const prev = get();
    const gpCurve = parseCurve(status.gpCurve);
    const observations = parseObservations(status.observations, prev.observations.length);
    const { progress, initialSigma } = calcConvergenceProgress(gpCurve, prev.initialMaxSigma);

    set({
      stage: status.stage,
      iteration: status.iteration,
      maxIterations: status.maxIterations,
      gpCurve,
      observations,
      bestCm360: status.currentBest ? status.currentBest[0] : null,
      bestScore: status.currentBest ? status.currentBest[1] : null,
      convergenceProgress: progress,
      initialMaxSigma: initialSigma,
    });
  },

  setFinalResult: (result, conversions) => set({
    view: 'result',
    finalResult: result,
    sensConversions: conversions,
    bestCm360: result.recommendedCm360,
    bestScore: result.recommendedScore,
    gpCurve: parseCurve(result.gpCurve),
    observations: parseObservations(result.observations, 0),
  }),

  loadMockData: () => {
    /** 포물선 형태 mock GP 곡선 (최적점 ~32 cm/360) */
    const curve: GPCurvePoint[] = [];
    for (let x = 20; x <= 50; x += 0.5) {
      const mean = -(((x - 32) / 12) ** 2) + 0.85;
      const variance = 0.01 + 0.003 * Math.abs(x - 32);
      curve.push({ x, mean, variance });
    }

    const obs: Observation[] = [
      { cm360: 25, score: 0.55, isLatest: false },
      { cm360: 30, score: 0.78, isLatest: false },
      { cm360: 32, score: 0.84, isLatest: false },
      { cm360: 35, score: 0.80, isLatest: false },
      { cm360: 28, score: 0.70, isLatest: false },
      { cm360: 33, score: 0.83, isLatest: false },
      { cm360: 31.5, score: 0.85, isLatest: true },
    ];

    set({
      view: 'optimizing',
      stage: 'Calibration',
      convergenceMode: 'quick',
      iteration: 7,
      maxIterations: 15,
      gpCurve: curve,
      observations: obs,
      bestCm360: 31.5,
      bestScore: 0.85,
      convergenceProgress: 0.62,
      initialMaxSigma: 0.18,
      eiRecommendation: { cm360: 31.0, ei: 0.003 },
      finalResult: null,
      sensConversions: [],
    });
  },

  reset: () => set({
    view: 'optimizing',
    stage: 'Screening',
    iteration: 0,
    maxIterations: 15,
    gpCurve: [],
    observations: [],
    bestCm360: null,
    bestScore: null,
    convergenceProgress: 0,
    initialMaxSigma: null,
    eiRecommendation: null,
    finalResult: null,
    sensConversions: [],
  }),
}));
