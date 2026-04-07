# Phase 1: 게임 프로필 시스템 — 상세 설계서

> **목표**: 유저가 게임을 선택하면, 그 게임에 맞는 모든 감도 필드가 자동으로 세팅되고, 프로필이 DB에 저장되며, 앱 전체가 그 프로필을 기준으로 동작한다.
> **작성일**: 2026-04-07

---

## 현재 문제 진단

### 1. GameProfileManager (src/components/GameProfileManager.tsx)
- 게임명이 **텍스트 자유입력** → gameDatabase 59개 게임과 연결 안 됨
- 감도 필드가 단일 `sensitivity` + `scopeMultiplier` 2개뿐
- PUBG는 감도 필드 10개, Apex는 5개, CS2는 2개 — 게임별 동적 폼 없음
- FOV가 수동 입력 → 게임 선택하면 자동 세팅돼야 함
- 게임 아이콘/아바타 없음 — 온보딩에선 있는데 여기선 없음

### 2. 온보딩 (src/components/Onboarding.tsx)
- 게임 선택 + 감도 입력까지 잘 됨
- **하지만 완료 시 settingsStore만 업데이트 → DB에 GameProfile 생성 안 됨**
- handleComplete()가 selectGame + setSensitivity만 호출
- createProfile IPC 호출 없음

### 3. profile_id 하드코딩
- useCalibrationHandlers.ts line 174: `profile_id: 1`
- 기타 invoke 호출에서도 profile_id: 1 하드코딩 추정

### 4. settingsStore ↔ gameProfileStore 단절
- settingsStore.selectGame()은 GamePreset 기준으로 cmPer360/hfov 계산
- gameProfileStore는 DB CRUD만 — settingsStore와 동기화 없음
- 프로필 활성화해도 settingsStore에 반영 안 됨

---

## 세부 태스크 분류

### Task 1-1-A: GameProfileManager 재설계 (프론트엔드)

#### UI 플로우
```
[+ 새 프로필] 클릭
  → 게임 선택 드롭다운/자동완성 (gameDatabase 59개)
    → 검색: 영문/한국어 모두 매칭
    → 카테고리 칩 필터 (온보딩처럼)
    → 이니셜 아바타 + 카테고리 색상 (온보딩처럼)
  → 게임 선택하면:
    → DPI 입력 (기본값: 현재 settingsStore.dpi)
    → 게임별 감도 필드 동적 렌더링
      - CS2: 감도(0.01~10), 줌감도비율(0.1~3)
      - PUBG: 일반감도(1~100), ADS(1~100), 1x~15x 각각(1~100), 자유시점(1~100) = 10개
      - Valorant: 감도(0.01~10) = 1개
      - Apex: 마우스감도(0.1~20), ADS 1x~4x배율 각각(0.1~5) = 5개
    → FOV 입력 (기본값: gameDatabase.defaultFov, 타입 표시)
    → cm/360 실시간 미리보기 (첫 번째 감도 필드 기준)
  → [저장]
    → DB에 GameProfile 생성 (game_id, game_name, custom_sens, custom_dpi, custom_fov, custom_cm360, keybinds_json에 sens_fields JSON 저장)
```

#### 프로필 카드 UI
```
┌──────────────────────────────────────────┐
│ [CS 아바타]  Counter-Strike 2     [Active] │
│  DPI: 800 | 감도: 1.0 | 줌비율: 1.0      │
│  FOV: 106.26 (H) | 46.2 cm/360           │
│  [활성화] [수정] [삭제]                    │
└──────────────────────────────────────────┘
┌──────────────────────────────────────────┐
│ [PU 아바타]  PUBG                         │
│  DPI: 800 | 일반: 50 | ADS: 50           │
│  FOV: 103 (H) | ??? cm/360               │
│  감도 10개 필드 (접힘)                     │
│  [활성화] [수정] [삭제]                    │
└──────────────────────────────────────────┘
```

#### 데이터 흐름
- 게임 선택 → `GAME_DATABASE.find(g => g.id === selectedId)` → sensitivityFields 배열로 폼 동적 생성
- 각 감도 필드: min/max/step/defaultValue는 gameDatabase에서 자동
- 저장 시: `keybinds_json`에 감도 필드 값들을 JSON으로 저장 (DB 스키마 변경 없이)
  - 예: `{"sensitivity": 1.0, "zoom_sensitivity_ratio": 1.0}` (CS2)
  - 예: `{"sensitivity": 50, "ads_sensitivity": 50, "scope_1x": 50, ...}` (PUBG)
- cm/360 계산: 첫 번째 sensitivityField의 값 × yaw × DPI로 계산

#### 기술 세부사항
- **파일**: `src/components/GameProfileManager.tsx` 전면 재작성
- **의존**: `src/data/gameDatabase.ts`의 `GAME_DATABASE`, `GameEntry`, `GameSensField`
- **IPC**: 기존 `create_game_profile` 커맨드 그대로 사용 (파라미터 완전히 채움)
  - `game_id`: gameDatabase entry의 id (예: "cs2", "pubg")
  - `game_name`: name (예: "Counter-Strike 2")
  - `custom_sens`: 첫 번째 sensitivityField 값
  - `custom_dpi`: DPI
  - `custom_fov`: FOV
  - `custom_cm360`: 계산된 cm/360
  - `keybinds_json`: 모든 sensitivityField 값 JSON (기존 keybinds 필드 재활용)
- **스토어**: `gameProfileStore.createProfile` 시그니처 변경 필요
  - 현재: `(gameName, dpi, sensitivity, fov, scopeMultiplier)` — Rust와 불일치
  - 변경: `(gameId, gameName, sens, dpi, fov, cm360, sensFieldsJson)`

---

### Task 1-1-B: gameProfileStore 재설계

#### 현재 문제
- `GameProfile` 타입이 Rust `GameProfileRow`와 불일치
  - TS: `{id, gameName, dpi, sensitivity, fov, scopeMultiplier, isActive, createdAt}`
  - Rust: `{id, profileId, gameId, gameName, customSens, customDpi, customFov, customCm360, keybindsJson, isActive, createdAt}`
- `createProfile`이 Rust IPC 파라미터를 제대로 전달 안 함
- `activeProfileId` getter 없음
- settingsStore와 동기화 메커니즘 없음

#### 변경사항
```typescript
// 새 GameProfile 타입 (Rust GameProfileRow와 1:1 매핑)
interface GameProfile {
  id: number;
  profileId: number;        // 추가: user profile_id
  gameId: string;           // 추가: gameDatabase entry id
  gameName: string;
  customSens: number;       // 이름 변경: sensitivity → customSens
  customDpi: number;        // 이름 변경: dpi → customDpi
  customFov: number;        // 이름 변경: fov → customFov
  customCm360: number;      // 추가: 계산된 cm/360
  sensFieldsJson: string;   // 추가: 게임별 감도 필드 JSON (keybinds_json 활용)
  isActive: boolean;
  createdAt: string;
}

// 새 getter
activeProfileId: number | null  // computed: profiles.find(p => p.isActive)?.id ?? null
activeProfile: GameProfile | null

// settingsStore 동기화
syncToSettings(profile: GameProfile): void
// → settingsStore에 dpi, sensitivity, cmPer360, fov, selectedGame 세팅
```

---

### Task 1-2: 온보딩 → 프로필 자동 생성

#### 현재 handleComplete()
```typescript
const handleComplete = () => {
  setStoreDpi(dpi);
  if (selectedGame) {
    selectGame(selectedGame);
    setStoreSensitivity(sensitivity);
  }
  setMode_(mode);
  completeOnboarding();
};
```

#### 변경 후 handleComplete()
```typescript
const handleComplete = async () => {
  setStoreDpi(dpi);
  if (selectedGame) {
    selectGame(selectedGame);
    setStoreSensitivity(sensitivity);

    // 게임 프로필 자동 생성
    const gameEntry = GAME_DATABASE.find(g => g.id === selectedGame.id);
    const cm360 = gameSensToCm360(sensitivity, dpi, selectedGame.yaw);

    // sensitivityFields 기본값으로 JSON 생성
    const sensFields: Record<string, number> = {};
    if (gameEntry) {
      for (const field of gameEntry.sensitivityFields) {
        if (field.key === 'sensitivity') {
          sensFields[field.key] = sensitivity; // 유저가 입력한 값
        } else {
          sensFields[field.key] = field.defaultValue; // 나머지는 기본값
        }
      }
    }

    // DB에 프로필 생성
    const profileId = await invoke('create_game_profile', {
      params: {
        profileId: 1, // TODO: Phase 1-3에서 동적으로
        gameId: selectedGame.id,
        gameName: selectedGame.name,
        customSens: sensitivity,
        customDpi: dpi,
        customFov: selectedGame.defaultFov,
        customCm360: cm360,
        keybindsJson: JSON.stringify(sensFields),
      }
    });

    // 생성된 프로필을 active로 설정
    await invoke('set_active_game_profile', {
      profileId: 1,
      gameProfileId: profileId,
    });

    // gameProfileStore 갱신
    await useGameProfileStore.getState().loadProfiles();
  }
  setMode_(mode);
  completeOnboarding();
};
```

#### 주의사항
- 온보딩의 감도 입력은 단일 필드 (첫 번째 sensitivityField만)
- 나머지 필드는 gameDatabase의 defaultValue 사용
- 프로필 생성 후 자동 active 설정
- 실패 시 toast 에러 + 온보딩은 계속 완료 (프로필은 나중에 수동 생성 가능)

---

### Task 1-3: profile_id 하드코딩 제거

#### 변경 대상 파일
1. `src/hooks/useCalibrationHandlers.ts` line 174: `profile_id: 1`
2. 기타 모든 `profile_id: 1` 하드코딩

#### 구현
```typescript
// gameProfileStore에 추가
get activeProfileId(): number | null {
  return this.profiles.find(p => p.isActive)?.id ?? null;
}

// 사용처에서
const activeId = useGameProfileStore.getState().activeProfileId;
if (!activeId) {
  // 프로필 없음 → 프로필 생성 유도
  useToastStore.getState().addToast('게임 프로필을 먼저 생성해주세요', 'warning');
  setScreen('game-profiles');
  return;
}
await invoke('start_calibration', {
  params: { profile_id: activeId, ... }
});
```

---

### Task 1-4: settingsStore ↔ gameProfileStore 동기화

#### 문제
프로필 활성화해도 settingsStore에 반영 안 됨. 캘리브레이션이 settingsStore.cmPer360을 읽는데, 프로필 전환 시 갱신 안 됨.

#### 구현
```typescript
// gameProfileStore.setActive 수정
setActive: async (id) => {
  const ok = await safeInvoke('set_active_game_profile', { profileId: 1, gameProfileId: id });
  if (ok !== null) {
    set((s) => ({
      profiles: s.profiles.map(p => ({ ...p, isActive: p.id === id })),
    }));

    // settingsStore 동기화
    const profile = get().profiles.find(p => p.id === id);
    if (profile) {
      const gameEntry = GAME_DATABASE.find(g => g.id === profile.gameId);
      if (gameEntry) {
        const gamePreset = { id: gameEntry.id, name: gameEntry.name, yaw: gameEntry.yaw, ... };
        useSettingsStore.getState().selectGame(gamePreset);
        useSettingsStore.getState().setDpi(profile.customDpi);
        useSettingsStore.getState().setSensitivity(profile.customSens);
      }
    }
  }
},
```

#### 앱 시작 시
- `App.tsx` 초기화에서 `loadProfiles()` → active 프로필 있으면 settingsStore 자동 동기화
- active 프로필 없으면 온보딩 또는 프로필 생성 화면으로 유도

---

## 실행 순서

1. **Task 1-1-B**: gameProfileStore 재설계 (타입, IPC 매핑, activeProfileId getter)
2. **Task 1-1-A**: GameProfileManager UI 재설계 (gameDatabase 연동, 동적 폼)
3. **Task 1-2**: 온보딩 → 프로필 자동 생성
4. **Task 1-3**: profile_id 하드코딩 제거
5. **Task 1-4**: settingsStore ↔ gameProfileStore 동기화 + 앱 초기화

각 태스크는 이전 태스크가 완료되어야 의미가 있다.
Rust 백엔드 IPC 커맨드는 이미 game_id, keybinds_json 필드를 지원하므로 백엔드 변경 불필요.
DB 스키마 변경도 불필요 — keybinds_json 필드를 sens_fields 저장에 재활용.

---

## 검증 기준

- [ ] 게임 선택 드롭다운에 59개 게임 표시 + 검색 동작
- [ ] 게임 선택 시 해당 게임의 sensitivityFields 동적 폼 렌더링
- [ ] PUBG 선택 시 10개 감도 필드 표시 + 기본값 세팅
- [ ] 온보딩 완료 시 DB에 GameProfile 생성 + active 설정
- [ ] 메인 화면에서 active 프로필 정보 정상 표시
- [ ] 프로필 전환 시 settingsStore (cmPer360, dpi, fov) 자동 갱신
- [ ] 캘리브레이션 시작 시 active 프로필 ID 사용 (하드코딩 1 아님)
- [ ] 프로필 없을 때 캘리브레이션 차단 + 프로필 생성 유도
