/**
 * Aim DNA 상태 스토어
 * 현재 DNA 프로파일, 히스토리 관리
 */
import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { AimDnaProfile, AimDnaHistoryEntry } from '../utils/types';

interface AimDnaState {
  /** 현재 DNA 프로파일 */
  currentDna: AimDnaProfile | null;
  /** 히스토리 엔트리 */
  history: AimDnaHistoryEntry[];
  /** 로딩 상태 */
  isLoading: boolean;

  // Actions
  /** DNA 직접 설정 (compute 결과 등) */
  setCurrentDna: (dna: AimDnaProfile) => void;
  /** DB에서 최신 DNA 로드 */
  loadDna: (profileId: number) => Promise<void>;
  /** DB에서 히스토리 로드 */
  loadHistory: (profileId: number, featureName?: string) => Promise<void>;
  /** 초기화 */
  clear: () => void;
}

export const useAimDnaStore = create<AimDnaState>((set) => ({
  currentDna: null,
  history: [],
  isLoading: false,

  setCurrentDna: (dna) => set({ currentDna: dna }),

  loadDna: async (profileId) => {
    set({ isLoading: true });
    try {
      const dna = await invoke<AimDnaProfile | null>('get_aim_dna', {
        params: { profile_id: profileId },
      });
      set({ currentDna: dna, isLoading: false });
    } catch (e) {
      console.error('Aim DNA 로드 실패:', e);
      set({ isLoading: false });
    }
  },

  loadHistory: async (profileId, featureName) => {
    try {
      const history = await invoke<AimDnaHistoryEntry[]>('get_aim_dna_history', {
        params: { profile_id: profileId, feature_name: featureName ?? null },
      });
      set({ history });
    } catch (e) {
      console.error('Aim DNA 히스토리 로드 실패:', e);
    }
  },

  clear: () => set({ currentDna: null, history: [], isLoading: false }),
}));
