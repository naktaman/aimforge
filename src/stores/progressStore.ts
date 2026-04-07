/**
 * Progress Dashboard 상태 스토어
 * 일별 통계, 스킬 진행도, DNA 시계열, 궤적 분석
 */
import { create } from 'zustand';
import { storeInvoke } from './storeHelpers';
import type {
  DailyStatRow,
  SkillProgressRow,
  AimDnaHistoryEntry,
  TrajectoryAnalysisResult,
} from '../utils/types';

interface ProgressState {
  dailyStats: DailyStatRow[];
  skillProgress: SkillProgressRow[];
  dnaTimeSeries: AimDnaHistoryEntry[];
  trajectoryAnalysis: TrajectoryAnalysisResult | null;
  isLoading: boolean;

  loadDailyStats: (profileId: number, days?: number) => Promise<void>;
  loadSkillProgress: (profileId: number) => Promise<void>;
  loadDnaTimeSeries: (profileId: number, featureName?: string) => Promise<void>;
  analyzeTrajectory: (trialId: number) => Promise<void>;
  clear: () => void;
}

export const useProgressStore = create<ProgressState>((set) => ({
  dailyStats: [],
  skillProgress: [],
  dnaTimeSeries: [],
  trajectoryAnalysis: null,
  isLoading: false,

  /* get_daily_stats / get_skill_progress: flat args (params 래퍼 없음, 직접 키) */
  loadDailyStats: (profileId, days = 30) =>
    storeInvoke<ProgressState, DailyStatRow[]>(
      set, 'get_daily_stats',
      { profile_id: profileId, days },
      (dailyStats) => ({ dailyStats }),
      '일별 통계 로드',
      false,
    ),

  loadSkillProgress: (profileId) =>
    storeInvoke<ProgressState, SkillProgressRow[]>(
      set, 'get_skill_progress',
      { profile_id: profileId },
      (skillProgress) => ({ skillProgress }),
      '스킬 진행도 로드',
      false,
    ),

  /* Rust GetAimDnaHistoryParams: #[serde(rename_all = "camelCase")] — camelCase 키 필수 */
  loadDnaTimeSeries: (profileId, featureName) =>
    storeInvoke<ProgressState, AimDnaHistoryEntry[]>(
      set, 'get_aim_dna_history',
      { params: { profileId, featureName: featureName ?? null } },
      (dnaTimeSeries) => ({ dnaTimeSeries }),
      'DNA 시계열 로드',
      false,
    ),

  /* analyze_trajectory_cmd: AnalyzeTrajectoryParams (params 래퍼, rename_all 없음) */
  analyzeTrajectory: (trialId) =>
    storeInvoke<ProgressState, TrajectoryAnalysisResult>(
      set, 'analyze_trajectory_cmd',
      { params: { trial_id: trialId } },
      (trajectoryAnalysis) => ({ trajectoryAnalysis }),
      '궤적 분석',
    ),

  clear: () => set({
    dailyStats: [],
    skillProgress: [],
    dnaTimeSeries: [],
    trajectoryAnalysis: null,
    isLoading: false,
  }),
}));
