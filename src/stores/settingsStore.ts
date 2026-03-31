/**
 * 설정 스토어 (zustand)
 * 하드웨어, 게임 프리셋, 감도, FOV 등 엔진 설정 관리
 */
import { create } from 'zustand';
import { gameSensToCm360, gameFovToHfov } from '../utils/physics';
import type { GamePreset } from '../utils/types';

interface SettingsState {
  // 하드웨어
  dpi: number;
  pollingRate: number;

  // 게임 프리셋
  selectedGame: GamePreset | null;
  sensitivity: number;
  cmPer360: number; // 자동 계산

  // FOV
  fovSetting: number;
  hfov: number; // 자동 계산

  // 스코프
  currentZoom: number; // 1 = hipfire
  scopeMultiplier: number;

  // 액션
  setDpi: (dpi: number) => void;
  setPollingRate: (rate: number) => void;
  selectGame: (game: GamePreset) => void;
  setSensitivity: (sens: number) => void;
  setFovSetting: (fov: number) => void;
  setZoom: (zoom: number, multiplier: number) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  // 기본값: CS2 기준
  dpi: 800,
  pollingRate: 1000,
  selectedGame: null,
  sensitivity: 1.0,
  cmPer360: 46.18,
  fovSetting: 106.26,
  hfov: 106.26,
  currentZoom: 1,
  scopeMultiplier: 1,

  setDpi: (dpi) => {
    const state = get();
    const cmPer360 = state.selectedGame
      ? gameSensToCm360(state.sensitivity, dpi, state.selectedGame.yaw)
      : state.cmPer360;
    set({ dpi, cmPer360 });
  },

  setPollingRate: (pollingRate) => set({ pollingRate }),

  selectGame: (game) => {
    const state = get();
    const cmPer360 = gameSensToCm360(state.sensitivity, state.dpi, game.yaw);
    const hfov = gameFovToHfov(
      game.default_fov,
      game.fov_type,
      game.default_aspect_ratio,
    );
    set({
      selectedGame: game,
      cmPer360,
      fovSetting: game.default_fov,
      hfov,
    });
  },

  setSensitivity: (sensitivity) => {
    const state = get();
    const cmPer360 = state.selectedGame
      ? gameSensToCm360(sensitivity, state.dpi, state.selectedGame.yaw)
      : state.cmPer360;
    set({ sensitivity, cmPer360 });
  },

  setFovSetting: (fovSetting) => {
    const state = get();
    const hfov = state.selectedGame
      ? gameFovToHfov(
          fovSetting,
          state.selectedGame.fov_type,
          state.selectedGame.default_aspect_ratio,
        )
      : fovSetting;
    set({ fovSetting, hfov });
  },

  setZoom: (currentZoom, scopeMultiplier) =>
    set({ currentZoom, scopeMultiplier }),
}));
