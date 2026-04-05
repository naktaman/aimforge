/**
 * 훈련 처방 + Readiness + Style Transition 상태 스토어
 */
import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { storeInvoke } from './storeHelpers';
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

/** 스타일 전환 상태를 로드하여 set에 반영하는 공통 함수 */
async function loadTransitionStatus(
  set: (partial: Partial<TrainingState>) => void,
  profileId: number,
): Promise<void> {
  try {
    const result = await invoke<{ transition: StyleTransitionRow | null; progress: TransitionProgress | null }>(
      'get_style_transition_status',
      { params: { profile_id: profileId } }
    );
    set({ styleTransition: result.transition, transitionProgress: result.progress });
  } catch (e) {
    console.error('스타일 전환 상태 로드 실패:', e);
  }
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

  startStyleTransition: async (profileId, fromType, toType, sensRange) => {
    try {
      await invoke('start_style_transition', {
        params: {
          profile_id: profileId,
          from_type: fromType,
          to_type: toType,
          target_sens_range: sensRange,
        },
      });
      await loadTransitionStatus(set, profileId);
    } catch (e) {
      console.error('스타일 전환 시작 실패:', e);
    }
  },

  loadStyleTransition: (profileId) => loadTransitionStatus(set, profileId),

  updateStyleTransition: async (profileId, action) => {
    try {
      await invoke('update_style_transition', {
        params: { profile_id: profileId, action },
      });
      await loadTransitionStatus(set, profileId);
    } catch (e) {
      console.error('스타일 전환 업데이트 실패:', e);
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
