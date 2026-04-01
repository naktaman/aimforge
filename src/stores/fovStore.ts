/**
 * FOV 프로파일 스토어
 * FOV 테스트 결과 CRUD, 비교 실행
 */
import { create } from 'zustand';
import { safeInvoke } from '../utils/ipc';
import type { FovProfileRow, FovRecommendation } from '../utils/types';

interface FovState {
  /** FOV 테스트 결과 목록 */
  results: FovProfileRow[];
  /** FOV 비교/추천 결과 */
  recommendation: FovRecommendation | null;
  /** 로딩 상태 */
  isLoading: boolean;

  /** 테스트 결과 로드 */
  loadResults: (profileId: number) => Promise<void>;
  /** 테스트 결과 저장 */
  saveResult: (params: {
    profile_id: number;
    fov_tested: number;
    scenario_type: string;
    score: number;
    peripheral_score?: number;
    center_score?: number;
  }) => Promise<number>;
  /** FOV 비교 분석 실행 */
  compare: (profileId: number) => Promise<void>;
  /** 테스트 결과 삭제 */
  deleteResults: (profileId: number) => Promise<void>;
  /** 초기화 */
  clear: () => void;
}

export const useFovStore = create<FovState>((set) => ({
  results: [],
  recommendation: null,
  isLoading: false,

  loadResults: async (profileId) => {
    set({ isLoading: true });
    const results = await safeInvoke<FovProfileRow[]>('get_fov_test_results', {
      params: { profile_id: profileId },
    });
    set({ results: results ?? [], isLoading: false });
  },

  saveResult: async (params) => {
    const id = await safeInvoke<number>('save_fov_test_result', {
      params: {
        profile_id: params.profile_id,
        fov_tested: params.fov_tested,
        scenario_type: params.scenario_type,
        score: params.score,
        peripheral_score: params.peripheral_score ?? null,
        center_score: params.center_score ?? null,
      },
    });
    return id ?? 0;
  },

  compare: async (profileId) => {
    set({ isLoading: true });
    const recommendation = await safeInvoke<FovRecommendation | null>('compare_fov_profiles', {
      params: { profile_id: profileId },
    });
    set({ recommendation: recommendation ?? null, isLoading: false });
  },

  deleteResults: async (profileId) => {
    await safeInvoke('delete_fov_test_results', { params: { profile_id: profileId } });
    set({ results: [], recommendation: null });
  },

  clear: () => set({ results: [], recommendation: null, isLoading: false }),
}));
