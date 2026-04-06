/**
 * 크로스게임 DNA 비교 스토어
 * 비교 실행, 결과 관리, 히스토리 조회
 */
import { create } from 'zustand';
import { storeInvoke } from './storeHelpers';
import { safeInvoke } from '../utils/ipc';
import type { CrossGameComparison, CrossGameComparisonSummary } from '../utils/types';

interface CrossGameState {
  /** 현재 비교 결과 */
  currentComparison: CrossGameComparison | null;
  /** 비교 히스토리 */
  history: CrossGameComparisonSummary[];
  /** 비교 진행 중 */
  isComparing: boolean;
  /** storeInvoke 호환 로딩 상태 */
  isLoading: boolean;

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
  isLoading: false,

  /** 크로스게임 DNA 비교 실행 — isComparing 직접 관리, safeInvoke로 에러 처리 */
  compareGames: async (refProfileId, targetProfileId, refMovement, targetMovement) => {
    set({ isComparing: true });
    const comparison = await safeInvoke<CrossGameComparison>('compare_game_dna', {
      params: {
        refProfileId: refProfileId,
        targetProfileId: targetProfileId,
        refGameMovementRatio: refMovement ?? null,
        targetGameMovementRatio: targetMovement ?? null,
      },
    }, true);
    set({
      currentComparison: comparison,
      isComparing: false,
    });
  },

  /** 비교 히스토리 로드 — storeInvoke로 로딩 자동 관리 */
  loadHistory: (profileId) =>
    storeInvoke<CrossGameState, CrossGameComparisonSummary[]>(
      set, 'get_cross_game_history_cmd',
      { params: { profileId: profileId } },
      (history) => ({ history }),
      '크로스게임 히스토리 로드',
      false,
    ),

  clear: () => set({ currentComparison: null, history: [], isComparing: false }),
}));
