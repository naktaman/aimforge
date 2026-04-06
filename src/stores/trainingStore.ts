/**
 * 훈련 처방 + Readiness + Style Transition 상태 스토어
 */
import { create } from 'zustand';
import { storeInvoke } from './storeHelpers';
import { safeInvoke } from '../utils/ipc';
import type {
  TrainingPrescription,
  StageRecommendation,
  StageResultRow,
  ReadinessInput,
  ReadinessResult,
  ReadinessScoreRow,
  StyleTransitionRow,
  TransitionProgress,
} from '../utils/types';

interface TrainingState {
  prescriptions: TrainingPrescription[];
  recommendations: StageRecommendation[];
  currentPrescription: TrainingPrescription | null;
  stageHistory: StageResultRow[];
  readiness: ReadinessResult | null;
  readinessHistory: ReadinessScoreRow[];
  styleTransition: StyleTransitionRow | null;
  transitionProgress: TransitionProgress | null;
  isLoading: boolean;

  loadPrescriptions: (profileId: number) => Promise<void>;
  generateCrossGamePrescriptions: (refId: number, targetId: number) => Promise<void>;
  loadRecommendations: (profileId: number) => Promise<void>;
  loadStageHistory: (profileId: number, stageType?: string) => Promise<void>;
  selectPrescription: (p: TrainingPrescription | null) => void;
  calculateReadiness: (input: ReadinessInput) => Promise<void>;
  loadReadinessHistory: (profileId: number) => Promise<void>;
  startStyleTransition: (profileId: number, fromType: string, toType: string, sensRange: string) => Promise<void>;
  loadStyleTransition: (profileId: number) => Promise<void>;
  updateStyleTransition: (profileId: number, action: string) => Promise<void>;
  clear: () => void;
}

/** 스타일 전환 상태를 로드하여 set에 반영하는 공통 함수 — storeInvoke 패턴 */
function loadTransitionStatus(
  set: Parameters<typeof storeInvoke<TrainingState, unknown>>[0],
  profileId: number,
): Promise<void> {
  return storeInvoke<TrainingState, { transition: StyleTransitionRow | null; progress: TransitionProgress | null }>(
    set, 'get_style_transition_status',
    { params: { profile_id: profileId } },
    (result) => ({ styleTransition: result.transition, transitionProgress: result.progress }),
    '스타일 전환 상태 로드',
    false,
  );
}

export const useTrainingStore = create<TrainingState>((set) => ({
  prescriptions: [],
  recommendations: [],
  currentPrescription: null,
  stageHistory: [],
  readiness: null,
  readinessHistory: [],
  styleTransition: null,
  transitionProgress: null,
  isLoading: false,

  loadPrescriptions: (profileId) =>
    storeInvoke<TrainingState, TrainingPrescription[]>(
      set, 'generate_training_prescriptions',
      { params: { profile_id: profileId } },
      (prescriptions) => ({ prescriptions }),
      '훈련 처방 생성',
    ),

  generateCrossGamePrescriptions: (refId, targetId) =>
    storeInvoke<TrainingState, TrainingPrescription[]>(
      set, 'generate_crossgame_prescriptions_cmd',
      { params: { ref_profile_id: refId, target_profile_id: targetId } },
      (prescriptions) => ({ prescriptions }),
      '크로스게임 처방 생성',
    ),

  loadRecommendations: (profileId) =>
    storeInvoke<TrainingState, StageRecommendation[]>(
      set, 'get_stage_recommendations',
      { params: { profile_id: profileId } },
      (recommendations) => ({ recommendations }),
      '스테이지 추천 로드',
      false,
    ),

  loadStageHistory: (profileId, stageType) =>
    storeInvoke<TrainingState, StageResultRow[]>(
      set, 'get_stage_results',
      { params: { profile_id: profileId, limit: 50, stage_type: stageType ?? null } },
      (stageHistory) => ({ stageHistory }),
      '스테이지 히스토리 로드',
      false,
    ),

  selectPrescription: (p) => set({ currentPrescription: p }),

  calculateReadiness: (input) =>
    storeInvoke<TrainingState, ReadinessResult>(
      set, 'calculate_readiness_score',
      { params: input },
      (readiness) => ({ readiness }),
      'Readiness Score 계산',
    ),

  loadReadinessHistory: (profileId) =>
    storeInvoke<TrainingState, ReadinessScoreRow[]>(
      set, 'get_readiness_history',
      { params: { profile_id: profileId, limit: 30 } },
      (readinessHistory) => ({ readinessHistory }),
      'Readiness 히스토리 로드',
      false,
    ),

  /** 스타일 전환 시작 — safeInvoke로 mutation 후 상태 재로드 */
  startStyleTransition: async (profileId, fromType, toType, sensRange) => {
    const ok = await safeInvoke('start_style_transition', {
      params: {
        profile_id: profileId,
        from_type: fromType,
        to_type: toType,
        target_sens_range: sensRange,
      },
    });
    if (ok !== null) {
      await loadTransitionStatus(set, profileId);
    }
  },

  loadStyleTransition: (profileId) => loadTransitionStatus(set, profileId),

  /** 스타일 전환 업데이트 — safeInvoke로 mutation 후 상태 재로드 */
  updateStyleTransition: async (profileId, action) => {
    const ok = await safeInvoke('update_style_transition', {
      params: { profile_id: profileId, action },
    });
    if (ok !== null) {
      await loadTransitionStatus(set, profileId);
    }
  },

  clear: () => set({
    prescriptions: [],
    recommendations: [],
    currentPrescription: null,
    stageHistory: [],
    readiness: null,
    readinessHistory: [],
    styleTransition: null,
    transitionProgress: null,
    isLoading: false,
  }),
}));
