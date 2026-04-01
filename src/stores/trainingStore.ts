/**
 * 훈련 처방 + Readiness + Style Transition 상태 스토어
 */
import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
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
  /** 생성된 훈련 처방 목록 */
  prescriptions: TrainingPrescription[];
  /** 스테이지 추천 목록 */
  recommendations: StageRecommendation[];
  /** 현재 선택된 처방 */
  currentPrescription: TrainingPrescription | null;
  /** 스테이지 결과 히스토리 */
  stageHistory: StageResultRow[];
  /** 최신 Readiness 결과 */
  readiness: ReadinessResult | null;
  /** Readiness 히스토리 */
  readinessHistory: ReadinessScoreRow[];
  /** 활성 스타일 전환 */
  styleTransition: StyleTransitionRow | null;
  /** 전환 진행 상태 */
  transitionProgress: TransitionProgress | null;
  /** 로딩 상태 */
  isLoading: boolean;

  // Actions
  /** 약점 기반 처방 생성 (단일 게임) */
  loadPrescriptions: (profileId: number) => Promise<void>;
  /** 크로스게임 갭 기반 처방 생성 */
  generateCrossGamePrescriptions: (refId: number, targetId: number) => Promise<void>;
  /** 스테이지 추천 로드 */
  loadRecommendations: (profileId: number) => Promise<void>;
  /** 스테이지 결과 히스토리 로드 */
  loadStageHistory: (profileId: number, stageType?: string) => Promise<void>;
  /** 처방 선택 */
  selectPrescription: (p: TrainingPrescription | null) => void;
  /** Readiness Score 계산 */
  calculateReadiness: (input: ReadinessInput) => Promise<void>;
  /** Readiness 히스토리 로드 */
  loadReadinessHistory: (profileId: number) => Promise<void>;
  /** 스타일 전환 시작 */
  startStyleTransition: (profileId: number, fromType: string, toType: string, sensRange: string) => Promise<void>;
  /** 스타일 전환 상태 로드 */
  loadStyleTransition: (profileId: number) => Promise<void>;
  /** 스타일 전환 업데이트 (완료/플래토 감지) */
  updateStyleTransition: (profileId: number, action: string) => Promise<void>;
  /** 초기화 */
  clear: () => void;
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

  loadPrescriptions: async (profileId) => {
    set({ isLoading: true });
    try {
      const prescriptions = await invoke<TrainingPrescription[]>('generate_training_prescriptions', {
        params: { profile_id: profileId },
      });
      set({ prescriptions, isLoading: false });
    } catch (e) {
      console.error('훈련 처방 생성 실패:', e);
      set({ isLoading: false });
    }
  },

  generateCrossGamePrescriptions: async (refId, targetId) => {
    set({ isLoading: true });
    try {
      const prescriptions = await invoke<TrainingPrescription[]>('generate_crossgame_prescriptions_cmd', {
        params: { ref_profile_id: refId, target_profile_id: targetId },
      });
      set({ prescriptions, isLoading: false });
    } catch (e) {
      console.error('크로스게임 처방 생성 실패:', e);
      set({ isLoading: false });
    }
  },

  loadRecommendations: async (profileId) => {
    try {
      const recommendations = await invoke<StageRecommendation[]>('get_stage_recommendations', {
        params: { profile_id: profileId },
      });
      set({ recommendations });
    } catch (e) {
      console.error('스테이지 추천 로드 실패:', e);
    }
  },

  loadStageHistory: async (profileId, stageType) => {
    try {
      const stageHistory = await invoke<StageResultRow[]>('get_stage_results', {
        params: { profile_id: profileId, limit: 50, stage_type: stageType ?? null },
      });
      set({ stageHistory });
    } catch (e) {
      console.error('스테이지 히스토리 로드 실패:', e);
    }
  },

  selectPrescription: (p) => set({ currentPrescription: p }),

  calculateReadiness: async (input) => {
    set({ isLoading: true });
    try {
      const readiness = await invoke<ReadinessResult>('calculate_readiness_score', {
        params: input,
      });
      set({ readiness, isLoading: false });
    } catch (e) {
      console.error('Readiness Score 계산 실패:', e);
      set({ isLoading: false });
    }
  },

  loadReadinessHistory: async (profileId) => {
    try {
      const readinessHistory = await invoke<ReadinessScoreRow[]>('get_readiness_history', {
        params: { profile_id: profileId, limit: 30 },
      });
      set({ readinessHistory });
    } catch (e) {
      console.error('Readiness 히스토리 로드 실패:', e);
    }
  },

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
      // 생성 후 바로 상태 로드
      const result = await invoke<{ transition: StyleTransitionRow | null; progress: TransitionProgress | null }>(
        'get_style_transition_status',
        { params: { profile_id: profileId } }
      );
      set({ styleTransition: result.transition, transitionProgress: result.progress });
    } catch (e) {
      console.error('스타일 전환 시작 실패:', e);
    }
  },

  loadStyleTransition: async (profileId) => {
    try {
      const result = await invoke<{ transition: StyleTransitionRow | null; progress: TransitionProgress | null }>(
        'get_style_transition_status',
        { params: { profile_id: profileId } }
      );
      set({ styleTransition: result.transition, transitionProgress: result.progress });
    } catch (e) {
      console.error('스타일 전환 상태 로드 실패:', e);
    }
  },

  updateStyleTransition: async (profileId, action) => {
    try {
      await invoke('update_style_transition', {
        params: { profile_id: profileId, action },
      });
      // 갱신 후 재로드
      const result = await invoke<{ transition: StyleTransitionRow | null; progress: TransitionProgress | null }>(
        'get_style_transition_status',
        { params: { profile_id: profileId } }
      );
      set({ styleTransition: result.transition, transitionProgress: result.progress });
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
