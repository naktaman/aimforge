/**
 * gameProfileStore / progressStore 단위 테스트
 * IPC invoke 모킹을 통한 스토어 상태 전이 검증
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { useGameProfileStore } from '../stores/gameProfileStore';
import { useProgressStore } from '../stores/progressStore';

// setup.ts에서 @tauri-apps/api/core invoke가 이미 vi.fn()으로 모킹됨

describe('gameProfileStore — 초기 상태', () => {
  beforeEach(() => {
    useGameProfileStore.setState({ profiles: [], isLoading: false });
  });

  it('초기 profiles는 빈 배열', () => {
    expect(useGameProfileStore.getState().profiles).toEqual([]);
  });

  it('초기 isLoading은 false', () => {
    expect(useGameProfileStore.getState().isLoading).toBe(false);
  });
});

describe('gameProfileStore — loadProfiles', () => {
  beforeEach(() => {
    useGameProfileStore.setState({ profiles: [], isLoading: false });
    vi.mocked(invoke).mockResolvedValue(null);
  });

  it('loadProfiles 성공 시 profiles 업데이트', async () => {
    const fakeRows = [
      {
        id: 1, gameName: 'CS2', dpi: 800, sensitivity: 1.5,
        fov: 106.26, scopeMultiplier: 1, isActive: 1, createdAt: '2024-01-01',
      },
    ];
    vi.mocked(invoke).mockResolvedValueOnce(fakeRows);

    await useGameProfileStore.getState().loadProfiles();

    const { profiles } = useGameProfileStore.getState();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].gameName).toBe('CS2');
    // isActive: 1(숫자) → true(불리언) 변환 검증
    expect(profiles[0].isActive).toBe(true);
  });

  it('loadProfiles 성공 시 isLoading이 false로 복귀', async () => {
    vi.mocked(invoke).mockResolvedValueOnce([]);
    await useGameProfileStore.getState().loadProfiles();
    expect(useGameProfileStore.getState().isLoading).toBe(false);
  });

  it('loadProfiles IPC 실패 시 profiles 유지, isLoading false', async () => {
    useGameProfileStore.setState({ profiles: [], isLoading: false });
    vi.mocked(invoke).mockRejectedValueOnce(new Error('IPC 오류'));
    await useGameProfileStore.getState().loadProfiles();
    expect(useGameProfileStore.getState().isLoading).toBe(false);
    expect(useGameProfileStore.getState().profiles).toEqual([]);
  });
});

describe('gameProfileStore — createProfile', () => {
  beforeEach(() => {
    useGameProfileStore.setState({ profiles: [], isLoading: false });
    // clearAllMocks 후 기본 null 반환 복구
    vi.mocked(invoke).mockResolvedValue(null);
  });

  it('createProfile 성공 후 목록 재로드', async () => {
    const fakeRows = [
      {
        id: 2, gameName: 'Valorant', dpi: 400, sensitivity: 0.8,
        fov: 103, scopeMultiplier: 1, isActive: 0, createdAt: '2024-01-02',
      },
    ];
    // create_game_profile → 생성된 ID 반환 (non-null이어야 ok !== null 조건 통과)
    // get_game_profiles → fakeRows 반환
    vi.mocked(invoke)
      .mockResolvedValueOnce(2)         // create_game_profile → 생성 ID
      .mockResolvedValueOnce(fakeRows); // get_game_profiles 재로드

    await useGameProfileStore.getState().createProfile('Valorant', 400, 0.8, 103, 1);

    const { profiles } = useGameProfileStore.getState();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].gameName).toBe('Valorant');
  });
});

describe('gameProfileStore — deleteProfile', () => {
  beforeEach(() => {
    useGameProfileStore.setState({
      profiles: [
        { id: 1, gameName: 'CS2', dpi: 800, sensitivity: 1, fov: 106, scopeMultiplier: 1, isActive: true, createdAt: '' },
        { id: 2, gameName: 'Apex', dpi: 800, sensitivity: 2, fov: 110, scopeMultiplier: 1, isActive: false, createdAt: '' },
      ],
      isLoading: false,
    });
    vi.mocked(invoke).mockResolvedValue(null);
  });

  it('deleteProfile 성공 시 로컬 상태에서 즉시 제거', async () => {
    // delete_game_profile → non-null 반환이어야 ok !== null 조건 통과
    vi.mocked(invoke).mockResolvedValueOnce(true); // delete_game_profile 성공
    await useGameProfileStore.getState().deleteProfile(1);
    const { profiles } = useGameProfileStore.getState();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].id).toBe(2);
  });

  it('deleteProfile IPC 실패 시 profiles 유지', async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error('삭제 실패'));
    await useGameProfileStore.getState().deleteProfile(1);
    expect(useGameProfileStore.getState().profiles).toHaveLength(2);
  });
});

describe('gameProfileStore — setActive', () => {
  beforeEach(() => {
    useGameProfileStore.setState({
      profiles: [
        { id: 1, gameName: 'CS2', dpi: 800, sensitivity: 1, fov: 106, scopeMultiplier: 1, isActive: true, createdAt: '' },
        { id: 2, gameName: 'Apex', dpi: 800, sensitivity: 2, fov: 110, scopeMultiplier: 1, isActive: false, createdAt: '' },
      ],
      isLoading: false,
    });
    // 기본 null 반환 복구 — safeInvoke가 null을 받아 ok !== null = true 처리
    vi.mocked(invoke).mockResolvedValue(null);
  });

  it('setActive 성공 시 해당 프로필만 isActive = true', async () => {
    // set_active_game_profile → non-null 반환이어야 ok !== null 조건 통과
    vi.mocked(invoke).mockResolvedValueOnce(true);
    await useGameProfileStore.getState().setActive(2);
    const { profiles } = useGameProfileStore.getState();
    expect(profiles.find(p => p.id === 1)?.isActive).toBe(false);
    expect(profiles.find(p => p.id === 2)?.isActive).toBe(true);
  });
});

// ─────────────────────────────────────────────

describe('progressStore — 초기 상태', () => {
  beforeEach(() => {
    useProgressStore.getState().clear();
  });

  it('초기 dailyStats는 빈 배열', () => {
    expect(useProgressStore.getState().dailyStats).toEqual([]);
  });

  it('초기 skillProgress는 빈 배열', () => {
    expect(useProgressStore.getState().skillProgress).toEqual([]);
  });

  it('초기 dnaTimeSeries는 빈 배열', () => {
    expect(useProgressStore.getState().dnaTimeSeries).toEqual([]);
  });

  it('초기 trajectoryAnalysis는 null', () => {
    expect(useProgressStore.getState().trajectoryAnalysis).toBeNull();
  });

  it('초기 isLoading은 false', () => {
    expect(useProgressStore.getState().isLoading).toBe(false);
  });
});

describe('progressStore — clear()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('데이터가 있을 때 clear() 호출 시 전체 초기화', () => {
    // 직접 상태 주입
    useProgressStore.setState({
      dailyStats: [{ date: '2024-01-01', avgScore: 80, sessionCount: 2, totalRounds: 10 } as any],
      skillProgress: [{ scenarioType: 'flick', currentLevel: 3 } as any],
      dnaTimeSeries: [{ recordedAt: '2024-01-01', features: {} } as any],
      trajectoryAnalysis: { summary: 'ok' } as any,
      isLoading: true,
    });

    useProgressStore.getState().clear();

    const state = useProgressStore.getState();
    expect(state.dailyStats).toEqual([]);
    expect(state.skillProgress).toEqual([]);
    expect(state.dnaTimeSeries).toEqual([]);
    expect(state.trajectoryAnalysis).toBeNull();
    expect(state.isLoading).toBe(false);
  });
});

describe('progressStore — IPC 로딩 상태', () => {
  beforeEach(() => {
    useProgressStore.getState().clear();
    // 각 테스트마다 기본 null 반환으로 리셋
    vi.mocked(invoke).mockResolvedValue(null);
  });

  it('loadDailyStats 성공 시 dailyStats 업데이트', async () => {
    const fakeStats = [
      { date: '2024-01-01', avgScore: 75, sessionCount: 1, totalRounds: 5 },
    ];
    // mockResolvedValue로 영구 세팅하여 순서 문제 방지
    vi.mocked(invoke).mockResolvedValue(fakeStats as any);
    await useProgressStore.getState().loadDailyStats(1);
    expect(useProgressStore.getState().dailyStats).toEqual(fakeStats);
  });

  it('loadSkillProgress 성공 시 skillProgress 업데이트', async () => {
    const fakeProgress = [
      { scenarioType: 'flick', currentLevel: 2, totalSessions: 10 },
    ];
    vi.mocked(invoke).mockResolvedValue(fakeProgress as any);
    await useProgressStore.getState().loadSkillProgress(1);
    expect(useProgressStore.getState().skillProgress).toEqual(fakeProgress);
  });
});
