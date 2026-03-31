/**
 * 인증 스토어 (zustand)
 * Steam OpenID 인증 상태, JWT 토큰, 유저 정보 관리
 * 서버 연결 시에만 활성화 (오프라인 모드에서는 미사용)
 */
import { create } from 'zustand';
import { apiClient } from '../utils/apiClient';

/** 유저 정보 */
export interface UserInfo {
  id: string;
  steamId: string;
  displayName: string;
  avatarUrl: string | null;
}

interface AuthState {
  /** 로그인 여부 */
  isLoggedIn: boolean;
  /** 서버 연결 여부 */
  isOnline: boolean;
  /** JWT 토큰 */
  token: string | null;
  /** 유저 정보 */
  user: UserInfo | null;
  /** 로딩 상태 */
  loading: boolean;

  /** 서버 연결 확인 */
  checkOnline: () => Promise<void>;
  /** Steam 로그인 (서버에서 JWT 수신) */
  loginWithSteam: (steamToken: string) => Promise<boolean>;
  /** 유저 정보 로드 */
  fetchMe: () => Promise<void>;
  /** 로그아웃 */
  logout: () => void;
  /** 토큰 설정 (앱 시작 시 로컬 저장소에서 복원) */
  restoreToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isLoggedIn: false,
  isOnline: false,
  token: null,
  user: null,
  loading: false,

  checkOnline: async () => {
    const online = await apiClient.isOnline();
    set({ isOnline: online });
  },

  loginWithSteam: async (steamToken) => {
    set({ loading: true });
    try {
      const result = await apiClient.post<{ token: string; user: UserInfo }>('/auth/steam', {
        steam_token: steamToken,
      });
      if (result) {
        apiClient.setToken(result.token);
        set({
          isLoggedIn: true,
          token: result.token,
          user: result.user,
          loading: false,
        });
        return true;
      }
      set({ loading: false });
      return false;
    } catch {
      set({ loading: false });
      return false;
    }
  },

  fetchMe: async () => {
    const { token } = get();
    if (!token) return;
    const user = await apiClient.get<UserInfo>('/auth/me');
    if (user) {
      set({ user, isLoggedIn: true });
    }
  },

  logout: () => {
    apiClient.setToken(null);
    set({ isLoggedIn: false, token: null, user: null });
  },

  restoreToken: (token) => {
    apiClient.setToken(token);
    set({ token });
  },
}));
