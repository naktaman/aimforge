/**
 * 설정 스토어 (zustand)
 * 하드웨어, 게임 프리셋, 감도, FOV 등 엔진 설정 관리
 */
import { create } from 'zustand';
import { gameSensToCm360, gameFovToHfov } from '../utils/physics';
import type { GamePreset, CrosshairConfig } from '../utils/types';
import { CROSSHAIR_PRESETS } from '../utils/types';
import type { VolumeSettings } from '../engine/SoundEngine';

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

  // 크로스헤어
  crosshair: CrosshairConfig;

  // 사운드 (B-1 Phase 4) — 5채널 볼륨 + 뮤트
  soundVolumes: VolumeSettings;
  soundMuted: boolean;

  // 액션
  setDpi: (dpi: number) => void;
  setPollingRate: (rate: number) => void;
  selectGame: (game: GamePreset) => void;
  setSensitivity: (sens: number) => void;
  setFovSetting: (fov: number) => void;
  setZoom: (zoom: number, multiplier: number) => void;
  setCrosshair: (config: Partial<CrosshairConfig>) => void;
  setCrosshairPreset: (presetName: string) => void;
  exportCrosshairCode: () => string;
  importCrosshairCode: (code: string) => boolean;
  setSoundVolumes: (volumes: Partial<VolumeSettings>) => void;
  setSoundMuted: (muted: boolean) => void;
  toggleSoundMute: () => void;
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

  // 사운드 기본값 (B-1 Phase 4)
  soundVolumes: {
    master: 0.7,
    hit: 0.7,
    ui: 0.7,
    gun: 0.6,
    ambient: 0.4,
  },
  soundMuted: false,

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
      game.defaultFov,
      game.fovType,
      game.defaultAspectRatio,
    );
    set({
      selectedGame: game,
      cmPer360,
      fovSetting: game.defaultFov,
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
          state.selectedGame.fovType,
          state.selectedGame.defaultAspectRatio,
        )
      : fovSetting;
    set({ fovSetting, hfov });
  },

  setZoom: (currentZoom, scopeMultiplier) =>
    set({ currentZoom, scopeMultiplier }),

  // 크로스헤어 기본값: CS2 프리셋
  crosshair: { ...CROSSHAIR_PRESETS[0].config },

  setCrosshair: (partial) => {
    const current = get().crosshair;
    set({ crosshair: { ...current, ...partial } });
  },

  setCrosshairPreset: (presetName) => {
    const preset = CROSSHAIR_PRESETS.find((p) => p.name === presetName);
    if (preset) set({ crosshair: { ...preset.config } });
  },

  /** 크로스헤어 설정을 share code로 인코딩 */
  exportCrosshairCode: () => {
    const c = get().crosshair;
    // 설정을 JSON → base64 인코딩 후 AIM- 프리픽스
    const json = JSON.stringify(c);
    const b64 = btoa(json);
    return `AIM-${b64}`;
  },

  /** share code에서 크로스헤어 설정 복원 — 필수 필드 전수 검증 */
  importCrosshairCode: (code) => {
    try {
      if (!code.startsWith('AIM-')) return false;
      const b64 = code.slice(4);
      const json = atob(b64);
      const config = JSON.parse(json) as CrosshairConfig;
      // 유효한 shape인지 확인
      const validShapes = ['cross', 'dot', 'circle', 't_shape', 'cross_dot'];
      if (!validShapes.includes(config.shape)) return false;
      // 숫자 필드 전수 검증
      const numFields: (keyof CrosshairConfig)[] = [
        'innerLength', 'outerLength', 'thickness', 'gap',
        'opacity', 'outlineThickness', 'dotSize', 'dynamicSpread',
      ];
      for (const f of numFields) {
        if (typeof config[f] !== 'number' || isNaN(config[f] as number)) return false;
      }
      // 불리언 필드 검증
      const boolFields: (keyof CrosshairConfig)[] = [
        'outlineEnabled', 'dotEnabled', 'dynamicEnabled',
      ];
      for (const f of boolFields) {
        if (typeof config[f] !== 'boolean') return false;
      }
      // 색상 필드 검증
      if (typeof config.color !== 'string' || typeof config.outlineColor !== 'string') return false;
      set({ crosshair: config });
      return true;
    } catch {
      return false;
    }
  },

  /** 사운드 볼륨 부분 업데이트 (B-1 Phase 4) */
  setSoundVolumes: (partial) => {
    const current = get().soundVolumes;
    set({ soundVolumes: { ...current, ...partial } });
  },

  /** 사운드 뮤트 설정 (B-1 Phase 4) */
  setSoundMuted: (muted) => set({ soundMuted: muted }),

  /** 사운드 뮤트 토글 (B-1 Phase 4) */
  toggleSoundMute: () => {
    set({ soundMuted: !get().soundMuted });
  },
}));
