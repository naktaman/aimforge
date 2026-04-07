/**
 * Aim DNA 상태 스토어
 * 현재 DNA 프로파일, 히스토리, 추세 분석, 레퍼런스 게임 관리
 */
import { create } from 'zustand';
import { storeInvoke } from './storeHelpers';
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
  setCurrentDna: (dna: AimDnaProfile) => void;
  loadDna: (profileId: number) => Promise<void>;
  loadHistory: (profileId: number, featureName?: string) => Promise<void>;
  loadSnapshots: (profileId: number, limit?: number) => Promise<void>;
  saveChangeEvent: (profileId: number, changeType: string, beforeValue: string | null, afterValue: string, description: string) => Promise<void>;
  loadChangeEvents: (profileId: number, limit?: number) => Promise<void>;
  compareSnapshots: (profileId: number, beforeId: number, afterId: number) => Promise<void>;
  detectStagnation: (profileId: number) => Promise<void>;
  loadTrend: (profileId: number) => Promise<void>;
  detectReferenceGame: () => Promise<void>;
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

  /* Rust Deserialize 구조체: #[serde(rename_all = "camelCase")] — camelCase 키 필수 */

  loadDna: (profileId) =>
    storeInvoke<AimDnaState, AimDnaProfile | null>(
      set, 'get_aim_dna',
      { params: { profileId } },
      (dna) => ({ currentDna: dna }),
      'Aim DNA 로드',
    ),

  loadHistory: (profileId, featureName) =>
    storeInvoke<AimDnaState, AimDnaHistoryEntry[]>(
      set, 'get_aim_dna_history',
      { params: { profileId, featureName: featureName ?? null } },
      (history) => ({ history }),
      'Aim DNA 히스토리 로드',
      false,
    ),

  loadSnapshots: (profileId, limit = 30) =>
    storeInvoke<AimDnaState, DnaSnapshot[]>(
      set, 'get_dna_snapshots_cmd',
      { params: { profileId, limit } },
      (snapshots) => ({ snapshots }),
      'DNA 스냅샷 로드',
      false,
    ),

  saveChangeEvent: (profileId, changeType, beforeValue, afterValue, description) =>
    storeInvoke<AimDnaState, number>(
      set, 'save_change_event_cmd',
      { params: { profileId, changeType, beforeValue, afterValue, description } },
      () => ({}),
      '변경점 이벤트 저장',
      false,
    ),

  loadChangeEvents: (profileId, limit = 50) =>
    storeInvoke<AimDnaState, DnaChangeEvent[]>(
      set, 'get_change_events_cmd',
      { params: { profileId, limit } },
      (changeEvents) => ({ changeEvents }),
      '변경점 이벤트 로드',
      false,
    ),

  compareSnapshots: (profileId, beforeId, afterId) =>
    storeInvoke<AimDnaState, SnapshotComparison>(
      set, 'compare_snapshots_cmd',
      { params: { profileId, beforeId, afterId } },
      (comparison) => ({ comparison }),
      '스냅샷 비교',
      false,
    ),

  detectStagnation: (profileId) =>
    storeInvoke<AimDnaState, StagnationResult>(
      set, 'detect_stagnation_cmd',
      { params: { profileId } },
      (stagnation) => ({ stagnation }),
      '정체기 감지',
      false,
    ),

  loadTrend: (profileId) =>
    storeInvoke<AimDnaState, DnaTrendResult>(
      set, 'get_dna_trend_cmd',
      { params: { profileId } },
      (trend) => ({ trend }),
      'DNA 추세 분석',
      false,
    ),

  detectReferenceGame: () =>
    storeInvoke<AimDnaState, ReferenceGameResult>(
      set, 'detect_reference_game_cmd',
      undefined,
      (referenceGame) => ({ referenceGame }),
      '레퍼런스 게임 감지',
      false,
    ),

  clear: () => set({
    currentDna: null, history: [], snapshots: [], changeEvents: [],
    comparison: null, stagnation: null, trend: null, referenceGame: null, isLoading: false,
  }),
}));
