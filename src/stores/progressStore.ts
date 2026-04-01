/**
 * Progress Dashboard 상태 스토어
 * 일별 통계, 스킬 진행도, DNA 시계열, 궤적 분석
 */
import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type {
  DailyStatRow,
  SkillProgressRow,
  AimDnaHistoryEntry,
  TrajectoryAnalysisResult,
} from '../utils/types';

interface ProgressState {
  /** 일별 통계 */
  dailyStats: DailyStatRow[];
  /** 스킬 진행도 (스테이지별) */
  skillProgress: SkillProgressRow[];
  /** DNA 시계열 데이터 */
  dnaTimeSeries: AimDnaHistoryEntry[];
  /** 궤적 분석 결과 */
  trajectoryAnalysis: TrajectoryAnalysisResult | null;
  /** 로딩 상태 */
  isLoading: boolean;

  // Actions
  /** 일별 통계 로드 */
  loadDailyStats: (profileId: number, days?: number) => Promise<void>;
  /** 스킬 진행도 로드 */
  loadSkillProgress: (profileId: number) => Promise<void>;
  /** DNA 시계열 로드 */
  loadDnaTimeSeries: (profileId: number, featureName?: string) => Promise<void>;
  /** 궤적 분석 실행 */
  analyzeTrajectory: (trialId: number) => Promise<void>;
  /** 초기화 */
  clear: () => void;
}

export const useProgressStore = create<ProgressState>((set) => ({
  dailyStats: [],
  skillProgress: [],
  dnaTimeSeries: [],
  trajectoryAnalysis: null,
  isLoading: false,

  loadDailyStats: async (profileId, days = 30) => {
    try {
      const dailyStats = await invoke<DailyStatRow[]>('get_daily_stats', {
        params: { profile_id: profileId, days },
      });
      set({ dailyStats });
    } catch (e) {
      console.error('일별 통계 로드 실패:', e);
    }
  },

  loadSkillProgress: async (profileId) => {
    try {
      const skillProgress = await invoke<SkillProgressRow[]>('get_skill_progress', {
        params: { profile_id: profileId },
      });
      set({ skillProgress });
    } catch (e) {
      console.error('스킬 진행도 로드 실패:', e);
    }
  },

  loadDnaTimeSeries: async (profileId, featureName) => {
    try {
      const dnaTimeSeries = await invoke<AimDnaHistoryEntry[]>('get_aim_dna_history', {
        params: { profile_id: profileId, feature_name: featureName ?? null },
      });
      set({ dnaTimeSeries });
    } catch (e) {
      console.error('DNA 시계열 로드 실패:', e);
    }
  },

  analyzeTrajectory: async (trialId) => {
    set({ isLoading: true });
    try {
      const trajectoryAnalysis = await invoke<TrajectoryAnalysisResult>('analyze_trajectory_cmd', {
        params: { trial_id: trialId },
      });
      set({ trajectoryAnalysis, isLoading: false });
    } catch (e) {
      console.error('궤적 분석 실패:', e);
      set({ isLoading: false });
    }
  },

  clear: () => set({
    dailyStats: [],
    skillProgress: [],
    dnaTimeSeries: [],
    trajectoryAnalysis: null,
    isLoading: false,
  }),
}));
