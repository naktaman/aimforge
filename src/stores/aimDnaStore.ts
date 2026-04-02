/**
 * Aim DNA 상태 스토어
 * 현재 DNA 프로파일, 히스토리, 추세 분석, 레퍼런스 게임 관리
 */
import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type {
  AimDnaProfile, AimDnaHistoryEntry, DnaTrendResult, ReferenceGameResult,
  DnaSnapshot, DnaChangeEvent, SnapshotComparison, StagnationResult,
} from '../utils/types';

interface AimDnaState {
  /** 현재 DNA 프로파일 */
  currentDna: AimDnaProfile | null;
  /** 피처별 히스토리 엔트리 */
  history: AimDnaHistoryEntry[];
  /** 5축 시계열 스냅샷 목록 */
  snapshots: DnaSnapshot[];
  /** 변경점 이벤트 목록 */
  changeEvents: DnaChangeEvent[];
  /** 현재 비교 결과 */
  comparison: SnapshotComparison | null;
  /** 정체기 감지 결과 */
  stagnation: StagnationResult | null;
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
  /** DB에서 피처별 히스토리 로드 */
  loadHistory: (profileId: number, featureName?: string) => Promise<void>;
  /** 5축 스냅샷 목록 로드 */
  loadSnapshots: (profileId: number, limit?: number) => Promise<void>;
  /** 변경점 이벤트 저장 */
  saveChangeEvent: (profileId: number, changeType: string, beforeValue: string | null, afterValue: string, description: string) => Promise<void>;
  /** 변경점 이벤트 목록 로드 */
  loadChangeEvents: (profileId: number, limit?: number) => Promise<void>;
  /** 두 스냅샷 비교 */
  compareSnapshots: (profileId: number, beforeId: number, afterId: number) => Promise<void>;
  /** 정체기 감지 */
  detectStagnation: (profileId: number) => Promise<void>;
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
  snapshots: [],
  changeEvents: [],
  comparison: null,
  stagnation: null,
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

  // 5축 스냅샷 목록 로드
  loadSnapshots: async (profileId, limit = 30) => {
    try {
      const snapshots = await invoke<DnaSnapshot[]>('get_dna_snapshots_cmd', {
        params: { profile_id: profileId, limit },
      });
      set({ snapshots });
    } catch (e) {
      console.error('DNA 스냅샷 로드 실패:', e);
    }
  },

  // 변경점 이벤트 저장
  saveChangeEvent: async (profileId, changeType, beforeValue, afterValue, description) => {
    try {
      await invoke<number>('save_change_event_cmd', {
        params: { profile_id: profileId, change_type: changeType, before_value: beforeValue, after_value: afterValue, description },
      });
    } catch (e) {
      console.error('변경점 이벤트 저장 실패:', e);
    }
  },

  // 변경점 이벤트 목록 로드
  loadChangeEvents: async (profileId, limit = 50) => {
    try {
      const changeEvents = await invoke<DnaChangeEvent[]>('get_change_events_cmd', {
        params: { profile_id: profileId, limit },
      });
      set({ changeEvents });
    } catch (e) {
      console.error('변경점 이벤트 로드 실패:', e);
    }
  },

  // 두 스냅샷 비교
  compareSnapshots: async (profileId, beforeId, afterId) => {
    try {
      const comparison = await invoke<SnapshotComparison>('compare_snapshots_cmd', {
        params: { profile_id: profileId, before_id: beforeId, after_id: afterId },
      });
      set({ comparison });
    } catch (e) {
      console.error('스냅샷 비교 실패:', e);
    }
  },

  // 정체기 감지
  detectStagnation: async (profileId) => {
    try {
      const stagnation = await invoke<StagnationResult>('detect_stagnation_cmd', {
        params: { profile_id: profileId },
      });
      set({ stagnation });
    } catch (e) {
      console.error('정체기 감지 실패:', e);
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

  clear: () => set({
    currentDna: null, history: [], snapshots: [], changeEvents: [],
    comparison: null, stagnation: null, trend: null, referenceGame: null, isLoading: false,
  }),
}));
