/**
 * 게임 프로필 스토어 (zustand)
 * 게임별 감도/DPI/FOV/키바인드 관리
 * Rust SQLite user_game_profiles 테이블과 동기화
 */
import { create } from 'zustand';
import { storeInvoke } from './storeHelpers';
import { safeInvoke } from '../utils/ipc';

/** 게임 프로필 */
export interface GameProfile {
  id: number;
  gameName: string;
  dpi: number;
  sensitivity: number;
  fov: number;
  scopeMultiplier: number;
  isActive: boolean;
  createdAt: string;
}

/** Rust에서 반환하는 row 타입 */
interface GameProfileRow {
  id: number;
  gameName: string;
  dpi: number;
  sensitivity: number;
  fov: number;
  scopeMultiplier: number;
  isActive: number;
  createdAt: string;
}

interface GameProfileState {
  profiles: GameProfile[];
  isLoading: boolean;

  /** 프로필 목록 로드 */
  loadProfiles: () => Promise<void>;
  /** 프로필 생성 */
  createProfile: (gameName: string, dpi: number, sensitivity: number, fov: number, scopeMultiplier: number) => Promise<void>;
  /** 프로필 수정 */
  updateProfile: (id: number, gameName: string, dpi: number, sensitivity: number, fov: number, scopeMultiplier: number) => Promise<void>;
  /** 프로필 삭제 */
  deleteProfile: (id: number) => Promise<void>;
  /** 활성 프로필 설정 */
  setActive: (id: number) => Promise<void>;
}

/** Rust row → 프론트엔드 타입 변환 */
function toProfile(row: GameProfileRow): GameProfile {
  return {
    id: row.id,
    gameName: row.gameName,
    dpi: row.dpi,
    sensitivity: row.sensitivity,
    fov: row.fov,
    scopeMultiplier: row.scopeMultiplier,
    isActive: row.isActive === 1,
    createdAt: row.createdAt,
  };
}

export const useGameProfileStore = create<GameProfileState>((set) => ({
  profiles: [],
  isLoading: false,

  /** 프로필 목록 로드 — storeInvoke로 로딩 상태 자동 관리 */
  loadProfiles: () =>
    storeInvoke<GameProfileState, GameProfileRow[]>(
      set, 'get_game_profiles', undefined,
      (rows) => ({ profiles: rows.map(toProfile) }),
      '게임 프로필 로드',
    ),

  /** 생성 후 목록 재로드 — safeInvoke로 mutation, storeInvoke로 재로드 */
  createProfile: async (gameName, dpi, sensitivity, fov, scopeMultiplier) => {
    const ok = await safeInvoke('create_game_profile', {
      gameName, dpi, sensitivity, fov, scopeMultiplier,
    }, true);
    if (ok !== null) {
      await storeInvoke<GameProfileState, GameProfileRow[]>(
        set, 'get_game_profiles', undefined,
        (rows) => ({ profiles: rows.map(toProfile) }),
        '게임 프로필 재로드',
      );
    }
  },

  /** 수정 후 목록 재로드 */
  updateProfile: async (id, gameName, dpi, sensitivity, fov, scopeMultiplier) => {
    const ok = await safeInvoke('update_game_profile', {
      id, gameName, dpi, sensitivity, fov, scopeMultiplier,
    });
    if (ok !== null) {
      await storeInvoke<GameProfileState, GameProfileRow[]>(
        set, 'get_game_profiles', undefined,
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

  /** 활성 프로필 설정 — 성공 시 로컬 상태 업데이트 */
  setActive: async (id) => {
    const ok = await safeInvoke('set_active_game_profile', { id });
    if (ok !== null) {
      set((s) => ({
        profiles: s.profiles.map(p => ({ ...p, isActive: p.id === id })),
      }));
    }
  },
}));
