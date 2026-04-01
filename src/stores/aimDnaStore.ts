/**
 * Aim DNA 상태 스토어
 * 현재 DNA 프로파일, 히스토리, 추세 분석, 레퍼런스 게임 관리
 */
import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { AimDnaProfile, AimDnaHistoryEntry, DnaTrendResult, ReferenceGameResult } from '../utils/types';

interface AimDnaState {
  /** 현재 DNA 프로파일 */
  currentDna: AimDnaProfile | null;
  /** 히스토리 엔트리 */
  history: AimDnaHistoryEntry[];
  /** DNA 추세 분석 결과 */
  trend: DnaTrendResult | null;
  /** 레퍼런스 게임 감지 결과 */
  referenceGame: ReferenceGameResult | null;
  /** 로딩 상태 */
  isLoading: boolean;

  // Actions
  /** DNA 직접 설정 (compute 결과 등) */
  setCurrentDna: (dna: AimDnaProfile) => void;
  /** DB에서 최신 DNA 로드 */
  loadDna: (profileId: number) => Promise<void>;
  /** DB에서 히스토리 로드 */
  loadHistory: (profileId: number, featureName?: string) => Promise<void>;
  /** DNA 추세 분석 로드 */
  loadTrend: (profileId: number) => Promise<void>;
  /** 레퍼런스 게임 자동 감지 */
  detectReferenceGame: () => Promise<void>;
  /** 초기화 */
  clear: () => void;
}

export const useAimDnaStore = create<AimDnaState>((set) => ({
  currentDna: null,
  history: [],
  trend: null,
  referenceGame: null,
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

  // DNA 시계열 추세 분석 — 재교정 필요 여부 판단
  loadTrend: async (profileId) => {
    try {
      const trend = await invoke<DnaTrendResult>('get_dna_trend_cmd', {
        params: { profile_id: profileId },
      });
      set({ trend });
    } catch (e) {
      console.error('DNA 추세 분석 실패:', e);
    }
  },

  // 레퍼런스 게임 자동 감지
  detectReferenceGame: async () => {
    try {
      const result = await invoke<ReferenceGameResult>('detect_reference_game_cmd');
      set({ referenceGame: result });
    } catch (e) {
      console.error('레퍼런스 게임 감지 실패:', e);
    }
  },

  clear: () => set({ currentDna: null, history: [], trend: null, referenceGame: null, isLoading: false }),
}));
