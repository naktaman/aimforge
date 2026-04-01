/**
 * 엔진 상태 스토어 (zustand)
 * 게임 엔진 ↔ React UI 간 브릿지
 * 고빈도 업데이트는 여기 저장하지 않음 (엔진 내부에서 직접 관리)
 */
import { create } from 'zustand';
import type { PerfData } from '../utils/types';

export type AppScreen =
  | 'settings' | 'viewport' | 'results'
  | 'calibration-setup' | 'calibration-progress' | 'calibration-result'
  | 'zoom-calibration-setup' | 'zoom-calibration-progress' | 'zoom-calibration-result'
  | 'comparator-result'
  | 'battery-progress' | 'battery-result' | 'aim-dna-result' | 'session-history'
  | 'display-settings' | 'game-profiles' | 'routines' | 'routine-player'
  | 'leaderboard' | 'community' | 'data-management'
  | 'cross-game-comparison'
  | 'training-prescription'
  | 'progress-dashboard'
  | 'trajectory-analysis'
  | 'style-transition'
  | 'movement-editor'
  | 'fov-comparison'
  | 'hardware-compare'
  | 'dual-landscape'
  | 'recoil-editor'
  | 'conversion-selector'
  | 'profile-wizard';

interface EngineState {
  /** 현재 화면 */
  currentScreen: AppScreen;
  /** 엔진 초기화 완료 여부 */
  engineReady: boolean;
  /** Pointer Lock 활성화 여부 */
  pointerLocked: boolean;
  /** 현재 FPS */
  fps: number;
  /** 퍼포먼스 오버레이 표시 여부 */
  perfOverlayVisible: boolean;
  /** 퍼포먼스 데이터 (1초마다 갱신) */
  perfData: PerfData | null;

  /** 화면 전환 */
  setScreen: (screen: AppScreen) => void;
  setEngineReady: (ready: boolean) => void;
  setPointerLocked: (locked: boolean) => void;
  setFps: (fps: number) => void;
  /** 퍼포먼스 오버레이 토글 */
  togglePerfOverlay: () => void;
  /** 퍼포먼스 데이터 업데이트 */
  setPerfData: (data: PerfData) => void;
}

export const useEngineStore = create<EngineState>((set) => ({
  currentScreen: 'settings',
  engineReady: false,
  pointerLocked: false,
  fps: 0,
  perfOverlayVisible: false,
  perfData: null,

  setScreen: (currentScreen) => set({ currentScreen }),
  setEngineReady: (engineReady) => set({ engineReady }),
  setPointerLocked: (pointerLocked) => set({ pointerLocked }),
  setFps: (fps) => set({ fps }),
  togglePerfOverlay: () => set((s) => ({ perfOverlayVisible: !s.perfOverlayVisible })),
  setPerfData: (perfData) => set({ perfData }),
}));
