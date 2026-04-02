/**
 * 게임 프로필 스토어 (zustand)
 * 게임별 감도/DPI/FOV/키바인드 관리
 * Rust SQLite user_game_profiles 테이블과 동기화
 */
import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { useToastStore } from './toastStore';

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
  loading: boolean;

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
  loading: false,

  loadProfiles: async () => {
    set({ loading: true });
    try {
      const rows = await invoke<GameProfileRow[]>('get_game_profiles');
      set({ profiles: rows.map(toProfile) });
    } catch (e) {
      console.error('[GameProfile] 로드 실패:', e);
    } finally {
      set({ loading: false });
    }
  },

  createProfile: async (gameName, dpi, sensitivity, fov, scopeMultiplier) => {
    try {
      await invoke('create_game_profile', {
        gameName, dpi, sensitivity, fov, scopeMultiplier,
      });
      // 재로드
      const rows = await invoke<GameProfileRow[]>('get_game_profiles');
      set({ profiles: rows.map(toProfile) });
    } catch (e) {
      console.error('[GameProfile] 생성 실패:', e);
    }
  },

  updateProfile: async (id, gameName, dpi, sensitivity, fov, scopeMultiplier) => {
    try {
      await invoke('update_game_profile', {
        id, gameName, dpi, sensitivity, fov, scopeMultiplier,
      });
      const rows = await invoke<GameProfileRow[]>('get_game_profiles');
      set({ profiles: rows.map(toProfile) });
    } catch (e) {
      console.error('[GameProfile] 수정 실패:', e);
      useToastStore.getState().addToast('프로필 수정 실패', 'error');
    }
  },

  deleteProfile: async (id) => {
    try {
      await invoke('delete_game_profile', { id });
      set((s) => ({ profiles: s.profiles.filter(p => p.id !== id) }));
    } catch (e) {
      console.error('[GameProfile] 삭제 실패:', e);
      useToastStore.getState().addToast('프로필 삭제 실패', 'error');
    }
  },

  setActive: async (id) => {
    try {
      await invoke('set_active_game_profile', { id });
      set((s) => ({
        profiles: s.profiles.map(p => ({ ...p, isActive: p.id === id })),
      }));
    } catch (e) {
      console.error('[GameProfile] 활성 설정 실패:', e);
      useToastStore.getState().addToast('프로필 활성 설정 실패', 'error');
    }
  },
}));
