/**
 * 무브먼트 시스템 스토어
 * 프리셋 로드, 프로필 CRUD, 가중 추천
 */
import { create } from 'zustand';
import { safeInvoke } from '../utils/ipc';
import type { MovementPreset, MovementProfileRow, WeightedRecommendation } from '../utils/types';

interface MovementState {
  /** 10개 게임 기본 프리셋 */
  presets: MovementPreset[];
  /** 현재 게임의 DB 프로필 */
  profiles: MovementProfileRow[];
  /** 가중 추천 결과 */
  recommendation: WeightedRecommendation | null;
  /** 로딩 상태 */
  isLoading: boolean;

  /** 기본 프리셋 로드 */
  loadPresets: () => Promise<void>;
  /** 게임별 프로필 로드 */
  loadProfiles: (gameId: number) => Promise<void>;
  /** 커스텀 프로필 저장 */
  saveProfile: (params: {
    gameId: number;
    name: string;
    maxSpeed: number;
    stopTime: number;
    accelType: string;
    airControl: number;
    csBonus: number;
  }) => Promise<number>;
  /** 프로필 수정 */
  updateProfile: (params: {
    id: number;
    name: string;
    maxSpeed: number;
    stopTime: number;
    accelType: string;
    airControl: number;
    csBonus: number;
  }) => Promise<void>;
  /** 프로필 삭제 */
  deleteProfile: (id: number) => Promise<void>;
  /** 가중 추천 계산 */
  calculateRecommendation: (staticOpt: number, movingOpt: number, ratio: number) => Promise<void>;
  /** JSON 내보내기 — 파일 경로 반환 */
  exportProfile: (params: {
    gameId: string;
    name: string;
    maxSpeed: number;
    stopTime: number;
    accelType: string;
    airControl: number;
    csBonus: number;
  }) => Promise<string | null>;
  /** JSON 가져오기 — 프리셋 반환 */
  importProfile: (jsonString: string) => Promise<MovementPreset | null>;
  /** 벽 도달 시간으로 maxSpeed 캘리브레이션 */
  calibrateMaxSpeed: (gameId: string, distance: number, timeSec: number) => Promise<{ calculatedMaxSpeed: number; distanceUsed: number } | null>;
  /** 초기화 */
  clear: () => void;
}

export const useMovementStore = create<MovementState>((set) => ({
  presets: [],
  profiles: [],
  recommendation: null,
  isLoading: false,

  loadPresets: async () => {
    const presets = await safeInvoke<MovementPreset[]>('get_movement_presets');
    set({ presets: presets ?? [] });
  },

  loadProfiles: async (gameId) => {
    set({ isLoading: true });
    const profiles = await safeInvoke<MovementProfileRow[]>('get_movement_profiles', {
      params: { gameId: gameId },
    });
    set({ profiles: profiles ?? [], isLoading: false });
  },

  saveProfile: async (params) => {
    const id = await safeInvoke<number>('save_movement_profile', { params });
    return id ?? 0;
  },

  updateProfile: async (params) => {
    await safeInvoke('update_movement_profile', { params });
  },

  deleteProfile: async (id) => {
    await safeInvoke('delete_movement_profile', { params: { id } });
  },

  calculateRecommendation: async (staticOpt, movingOpt, ratio) => {
    const rec = await safeInvoke<WeightedRecommendation>('calculate_weighted_recommendation', {
      params: {
        staticOptimal: staticOpt,
        movingOptimal: movingOpt,
        movementRatio: ratio,
      },
    });
    set({ recommendation: rec ?? null });
  },

  exportProfile: async (params) => {
    const path = await safeInvoke<string>('export_movement_profile', { params });
    return path;
  },

  importProfile: async (jsonString) => {
    const preset = await safeInvoke<MovementPreset>('import_movement_profile_from_string', {
      jsonString,
    });
    return preset;
  },

  calibrateMaxSpeed: async (gameId, distance, timeSec) => {
    const result = await safeInvoke<{ calculatedMaxSpeed: number; distanceUsed: number }>(
      'calibrate_max_speed',
      { params: { gameId: gameId, distanceUnits: distance, measuredTimeSec: timeSec } },
    );
    return result;
  },

  clear: () => set({ presets: [], profiles: [], recommendation: null, isLoading: false }),
}));
