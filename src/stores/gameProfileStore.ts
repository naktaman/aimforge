/**
 * 게임 프로필 스토어 (zustand)
 * 게임별 감도/DPI/FOV/키바인드 관리
 * Rust SQLite user_game_profiles 테이블과 동기화
 */
import { create } from 'zustand';
import { storeInvoke } from './storeHelpers';
import { safeInvoke } from '../utils/ipc';
import { useSettingsStore } from './settingsStore';
import { GAME_DATABASE } from '../data/gameDatabase';
import type { GamePreset } from '../utils/types';

/** 게임 프로필 — Rust GameProfileRow와 1:1 매핑 */
export interface GameProfile {
  id: number;
  profileId: number;        // user profile_id
  gameId: string;           // gameDatabase entry id ("cs2", "pubg" 등)
  gameName: string;
  customSens: number;
  customDpi: number;
  customFov: number;
  customCm360: number;      // 계산된 cm/360
  sensFieldsJson: string;   // 게임별 감도 필드 JSON (Rust keybindsJson)
  isActive: boolean;
  createdAt: string;
}

/** Rust에서 반환하는 row 타입 (serde rename_all camelCase) */
interface GameProfileRow {
  id: number;
  profileId: number;
  gameId: string;
  gameName: string;
  customSens: number;
  customDpi: number;
  customFov: number;
  customCm360: number;
  keybindsJson: string;
  isActive: boolean;        // Rust bool → JSON boolean
  createdAt: string;
}

/** createProfile 파라미터 */
interface CreateGameProfileInput {
  profileId: number;
  gameId: string;
  gameName: string;
  customSens: number;
  customDpi: number;
  customFov: number;
  customCm360: number;
  sensFieldsJson: string;
}

/** updateProfile 파라미터 */
interface UpdateGameProfileInput {
  id: number;
  customSens: number;
  customDpi: number;
  customFov: number;
  customCm360: number;
  sensFieldsJson: string;
}

interface GameProfileState {
  profiles: GameProfile[];
  isLoading: boolean;

  /** 활성 프로필 ID getter */
  activeProfileId: () => number | null;
  /** 활성 프로필 getter */
  activeProfile: () => GameProfile | null;

  /** 프로필 목록 로드 */
  loadProfiles: () => Promise<void>;
  /** 프로필 생성 — 생성된 ID 반환 */
  createProfile: (params: CreateGameProfileInput) => Promise<number | null>;
  /** 프로필 수정 */
  updateProfile: (params: UpdateGameProfileInput) => Promise<void>;
  /** 프로필 삭제 */
  deleteProfile: (id: number) => Promise<void>;
  /** 활성 프로필 설정 */
  setActive: (id: number) => Promise<void>;
  /** 활성 프로필 → settingsStore 동기화 */
  syncActiveToSettings: () => void;
}

/** 게임 프로필 → settingsStore 동기화 (dpi, sensitivity, selectedGame) */
function syncProfileToSettings(profile: GameProfile): void {
  const gameEntry = GAME_DATABASE.find(g => g.id === profile.gameId);
  if (!gameEntry) return;

  // GameEntry → GamePreset 변환 (fovType 'diagonal' → 'horizontal' 폴백)
  const fovType: GamePreset['fovType'] =
    gameEntry.fovType === 'diagonal' ? 'horizontal' : gameEntry.fovType;
  const preset: GamePreset = {
    id: gameEntry.id,
    name: gameEntry.name,
    yaw: gameEntry.yaw,
    defaultFov: gameEntry.defaultFov,
    fovType,
    defaultAspectRatio: gameEntry.defaultAspectRatio,
    sensStep: gameEntry.sensStep,
    movementRatio: gameEntry.movementRatio,
  };

  const settings = useSettingsStore.getState();
  settings.selectGame(preset);
  settings.setDpi(profile.customDpi);
  settings.setSensitivity(profile.customSens);
}

/** Rust row → 프론트엔드 타입 변환 (keybindsJson → sensFieldsJson 매핑) */
function toProfile(row: GameProfileRow): GameProfile {
  return {
    id: row.id,
    profileId: row.profileId,
    gameId: row.gameId,
    gameName: row.gameName,
    customSens: row.customSens,
    customDpi: row.customDpi,
    customFov: row.customFov,
    customCm360: row.customCm360,
    sensFieldsJson: row.keybindsJson,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

export const useGameProfileStore = create<GameProfileState>((set, get) => ({
  profiles: [],
  isLoading: false,

  /** 활성 프로필 ID — profiles에서 isActive인 항목의 id */
  activeProfileId: (): number | null =>
    get().profiles.find(p => p.isActive)?.id ?? null,

  /** 활성 프로필 객체 */
  activeProfile: (): GameProfile | null =>
    get().profiles.find(p => p.isActive) ?? null,

  /** 프로필 목록 로드 — Rust get_game_profiles(profile_id) 호출 */
  loadProfiles: () =>
    storeInvoke<GameProfileState, GameProfileRow[]>(
      set, 'get_game_profiles', { profileId: 1 }, // 단일 사용자 — user profiles.id
      (rows) => ({ profiles: rows.map(toProfile) }),
      '게임 프로필 로드',
    ),

  /** 생성 후 목록 재로드 — Rust CreateGameProfileParams로 전달 */
  createProfile: async (params) => {
    const result = await safeInvoke<number>('create_game_profile', {
      params: {
        profileId: params.profileId,
        gameId: params.gameId,
        gameName: params.gameName,
        customSens: params.customSens,
        customDpi: params.customDpi,
        customFov: params.customFov,
        customCm360: params.customCm360,
        keybindsJson: params.sensFieldsJson,
      },
    }, true);
    if (result !== null) {
      await storeInvoke<GameProfileState, GameProfileRow[]>(
        set, 'get_game_profiles', { profileId: params.profileId },
        (rows) => ({ profiles: rows.map(toProfile) }),
        '게임 프로필 재로드',
      );
    }
    return result;
  },

  /** 수정 후 목록 재로드 — Rust UpdateGameProfileParams로 전달 */
  updateProfile: async (params) => {
    const ok = await safeInvoke('update_game_profile', {
      params: {
        id: params.id,
        customSens: params.customSens,
        customDpi: params.customDpi,
        customFov: params.customFov,
        customCm360: params.customCm360,
        keybindsJson: params.sensFieldsJson,
      },
    });
    if (ok !== null) {
      // 재로드 — 현재 프로필 목록에서 profileId 추출
      const profileId = get().profiles.find(p => p.id === params.id)?.profileId ?? 1;
      await storeInvoke<GameProfileState, GameProfileRow[]>(
        set, 'get_game_profiles', { profileId },
        (rows) => ({ profiles: rows.map(toProfile) }),
        '게임 프로필 재로드',
      );
    }
  },

  /** 삭제 — 성공 시 로컬 상태에서 즉시 제거 */
  deleteProfile: async (id) => {
    const ok = await safeInvoke('delete_game_profile', { id });
    if (ok !== null) {
      set((s) => ({ profiles: s.profiles.filter(p => p.id !== id) }));
    }
  },

  /** 활성 프로필 설정 — Rust set_active_game_profile + settingsStore 동기화 */
  setActive: async (id) => {
    const profileId = get().profiles.find(p => p.id === id)?.profileId ?? 1;
    const ok = await safeInvoke('set_active_game_profile', {
      profileId,
      gameProfileId: id,
    });
    if (ok !== null) {
      set((s) => ({
        profiles: s.profiles.map(p => ({ ...p, isActive: p.id === id })),
      }));
      // 활성 프로필 → settingsStore 자동 반영
      const profile = get().profiles.find(p => p.id === id);
      if (profile) syncProfileToSettings(profile);
    }
  },

  /** 현재 활성 프로필로 settingsStore 동기화 (앱 초기화용) */
  syncActiveToSettings: () => {
    const active = get().profiles.find(p => p.isActive);
    if (active) syncProfileToSettings(active);
  },
}));
