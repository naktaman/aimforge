/**
 * 크로스게임 DNA 비교 스토어
 * 비교 실행, 결과 관리, 히스토리 조회
 */
import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { CrossGameComparison, CrossGameComparisonSummary } from '../utils/types';

interface CrossGameState {
  /** 현재 비교 결과 */
  currentComparison: CrossGameComparison | null;
  /** 비교 히스토리 */
  history: CrossGameComparisonSummary[];
  /** 비교 진행 중 */
  isComparing: boolean;

  // Actions
  /** 두 게임 프로파일 비교 실행 */
  compareGames: (
    refProfileId: number,
    targetProfileId: number,
    refMovement?: number,
    targetMovement?: number,
  ) => Promise<void>;
  /** 히스토리 로드 */
  loadHistory: (profileId: number) => Promise<void>;
  /** 초기화 */
  clear: () => void;
}

export const useCrossGameStore = create<CrossGameState>((set) => ({
  currentComparison: null,
  history: [],
  isComparing: false,

  // 크로스게임 DNA 비교 실행
  compareGames: async (refProfileId, targetProfileId, refMovement, targetMovement) => {
    set({ isComparing: true });
    try {
      const comparison = await invoke<CrossGameComparison>('compare_game_dna', {
        params: {
          refProfileId: refProfileId,
          targetProfileId: targetProfileId,
          refGameMovementRatio: refMovement ?? null,
          targetGameMovementRatio: targetMovement ?? null,
        },
      });
      set({ currentComparison: comparison, isComparing: false });
    } catch (e) {
      console.error('크로스게임 비교 실패:', e);
      set({ isComparing: false });
    }
  },

  // 비교 히스토리 로드
  loadHistory: async (profileId) => {
    try {
      const history = await invoke<CrossGameComparisonSummary[]>('get_cross_game_history_cmd', {
        params: { profileId: profileId },
      });
      set({ history });
    } catch (e) {
      console.error('크로스게임 히스토리 로드 실패:', e);
    }
  },

  clear: () => set({ currentComparison: null, history: [], isComparing: false }),
}));
