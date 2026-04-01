/**
 * UI 환경설정 스토어
 * 모드(Simple/Advanced), 테마(Dark/Light), 로케일(ko/en), 온보딩 상태 관리
 * user_settings 테이블에 영속화
 */
import { create } from 'zustand';
import { safeInvoke } from '../utils/ipc';

export type AppMode = 'simple' | 'advanced';
export type AppTheme = 'dark' | 'light';
export type AppLocale = 'ko' | 'en';

interface UiState {
  // 상태
  mode: AppMode;
  theme: AppTheme;
  locale: AppLocale;
  onboardingCompleted: boolean;
  loaded: boolean; // DB 로드 완료 여부

  // 액션
  setMode: (mode: AppMode) => void;
  toggleMode: () => void;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
  setLocale: (locale: AppLocale) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  loadFromDb: () => Promise<void>;
}

/** DB에 설정 저장 (profileId=1 고정) */
async function saveSetting(key: string, value: string) {
  await safeInvoke('save_user_setting', {
    profileId: 1,
    key,
    value,
  }, true);
}

/** 테마를 DOM + localStorage에 동기 적용 */
function applyTheme(theme: AppTheme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('aimforge-theme', theme);
}

export const useUiStore = create<UiState>((set, get) => ({
  mode: 'simple',
  theme: 'dark',
  locale: 'ko',
  onboardingCompleted: false,
  loaded: false,

  setMode: (mode) => {
    set({ mode });
    saveSetting('ui_mode', mode);
  },

  toggleMode: () => {
    const next = get().mode === 'simple' ? 'advanced' : 'simple';
    get().setMode(next);
  },

  setTheme: (theme) => {
    set({ theme });
    applyTheme(theme);
    saveSetting('ui_theme', theme);
  },

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },

  setLocale: (locale) => {
    set({ locale });
    saveSetting('ui_locale', locale);
  },

  completeOnboarding: () => {
    set({ onboardingCompleted: true });
    saveSetting('onboarding_completed', 'true');
  },

  resetOnboarding: () => {
    set({ onboardingCompleted: false });
    saveSetting('onboarding_completed', 'false');
  },

  /** 앱 시작 시 DB에서 설정 로드 */
  loadFromDb: async () => {
    const rows = await safeInvoke<[string, string][]>(
      'get_all_user_settings',
      { profileId: 1 },
      true,
    );
    if (!rows) {
      set({ loaded: true });
      return;
    }

    const map = new Map(rows);
    const patch: Partial<UiState> = { loaded: true };

    // 모드
    const mode = map.get('ui_mode');
    if (mode === 'simple' || mode === 'advanced') {
      patch.mode = mode;
    }

    // 테마
    const theme = map.get('ui_theme');
    if (theme === 'dark' || theme === 'light') {
      patch.theme = theme;
      applyTheme(theme);
    }

    // 로케일
    const locale = map.get('ui_locale');
    if (locale === 'ko' || locale === 'en') {
      patch.locale = locale;
    }

    // 온보딩
    const onboarding = map.get('onboarding_completed');
    if (onboarding === 'true') {
      patch.onboardingCompleted = true;
    }

    set(patch as UiState);
  },
}));
