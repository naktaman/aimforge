# AimForge 코드 헬스체크 #2: React 프론트엔드 + 상태 관리

> **분석일:** 2026-04-01
> **분석 범위:** src/ 전체 (컴포넌트 49개, 스토어 18개, 엔진, 유틸)
> **원칙:** 코드 수정 금지. 읽기 전용 분석 & 리포트만.

---

## 1. 컴포넌트 구조 이슈

### 1.1 복잡도 (300 LOC 이상)

| 파일 | 라인수 | 위험도 |
|------|--------|--------|
| App.tsx | 1,183 | P0 |
| utils/types.ts | 1,125 | P2 (타입 정의 파일) |
| engine/scenarios/MicroFlickScenario.ts | 513 | P2 |
| components/ScenarioSelect.tsx | 504 | P1 |
| components/MovementEditor.tsx | 487 | P1 |
| engine/scenarios/stages/CustomDrillScenario.ts | 436 | P2 |
| components/PerformanceLandscape.tsx | 420 | P2 |
| engine/GameEngine.ts | 402 | P2 |
| components/RecoilEditor.tsx | 388 | P1 |
| components/CrossGameComparison.tsx | 378 | P1 |

> **App.tsx 1,183줄**은 가장 심각. 20+ useState/useRef/useCallback, 30줄 이상 조건부 JSX 렌더링.

### 1.2 타입 안전성

#### `any` 타입 사용 (4건)

| 파일:라인 | 코드 | 위험도 |
|----------|------|--------|
| App.tsx:826 | `invoke<any>('adjust_k', { delta })` | P1 |
| PerformanceLandscape.tsx:130-131 | `d3.axisBottom(...) as any` (2건) | P1 |
| ProgressDashboard.tsx:75 | `d3.timeFormat(...) as unknown as ...` | P1 |

#### `as` 타입 캐스팅 (주요 80+건)
- App.tsx:618-705 — 연속적 `as number` 캐스팅 (기본값 처리) | P1
- stores/settingsStore.ts:133,143 — JSON 파싱 후 as 캐스팅 | P2
- engine/Target.ts:88,91,115,125,126 — Material 캐스팅 | P1
- components/DisplaySettings.tsx:44 — `map.get(...) as DisplayMode` | P2
- utils/ipc.ts:22 — `(e as Error).message` | P2 (예외 처리 패턴)

#### Optional chaining 3단계 이상: **없음** ✅

### 1.3 데드코드

| 파일 | 항목 | 위험도 |
|------|------|--------|
| components/overlays/Crosshair.tsx:170 | `export function CrosshairLegacy(...)` — import 없음 | P2 |

> 주석처리 코드 블록 5줄 이상: **없음** ✅
> 미사용 import: **주요 문제 없음** ✅

### 1.4 에러 바운더리

- **ErrorBoundary.tsx** 존재, `main.tsx:13`에서 `<ErrorBoundary>` 최상위 래핑 ✅
- **crashReporter** 전역 에러 핸들러 설치됨 ✅

#### invoke 에러 핸들링 누락

| 파일:라인 | 코드 | 위험도 |
|----------|------|--------|
| ScenarioSelect.tsx:152 | `invoke('get_available_games').then(setGames)` — catch 없음 | P0 |
| App.tsx:775 | `await invoke('cancel_calibration')` — try-catch 없음 | P1 |
| App.tsx:787 | `await invoke('start_zoom_calibration', {...})` — try-catch 없음 | P1 |
| Onboarding.tsx:29 | `.catch(()=>{})` — 완전 silent | P1 |
| CommunityShare.tsx:44 | `catch {}` — 빈 catch 블록 | P1 |

---

## 2. 상태 관리 이슈

### 2.1 중복 State

| 위치 | 설명 | 위험도 |
|------|------|--------|
| sessionStore.ts:25-34 + App.tsx | 세션 결과(flick/tracking/zoom 등)를 sessionStore와 App.tsx에서 동시 관리 | P1 |
| App.tsx:94-96 | editingRoutineId/Name를 App 레벨에서 관리, routineStore와 중복 가능 | P2 |

### 2.2 useEffect 위험

#### 무한 루프 위험

| 파일:라인 | 설명 | 위험도 |
|----------|------|--------|
| App.tsx:84 | `useEffect(()=>{ loadFromDb() }, [loadFromDb])` — loadFromDb가 매 렌더링 재생성 시 무한 루프 | P1 |
| RoutinePlayer.tsx:24-47 | currentIndex 변경 → useEffect → setInterval 재생성 → setState → currentIndex 변경 | P1 |

#### 클린업 현황
- PerformanceLandscape.tsx — keydown removeEventListener ✅
- RecoilEditor.tsx — stopSpray() 클린업 ✅
- RoutinePlayer.tsx — clearInterval 클린업 ✅

### 2.3 렌더링 성능

| 이슈 | 설명 | 위험도 |
|------|------|--------|
| React.memo 미적용 | 49개 컴포넌트 중 **0개** 사용 | P2 |
| D3 차트 리렌더 | AimDnaResult RadarChart, PerformanceLandscape — parent 리렌더 시 재생성 | P1 |
| Virtualization | 리스트 최대 50~100건으로 현재 불필요 | P2 |

### 2.4 Tauri 통신 패턴

#### safeInvoke vs 직접 invoke

| 영역 | safeInvoke | 직접 invoke | 비율 |
|------|-----------|-----------|------|
| components/ (49개) | 28건 | 11건 | 72% |
| stores/ (18개) | **0건** | **51+건** | **0%** |

> **stores 전체가 직접 invoke 사용** — safeInvoke 통일 필요 (P1)

#### invoke 에러 시 UI 피드백 누락

| 파일 | 에러 처리 | UI 피드백 | 위험도 |
|------|----------|----------|--------|
| stores/aimDnaStore.ts | console.error만 | 없음 (silent) | P1 |
| stores/trainingStore.ts | console.error만 | 없음 | P1 |
| stores/routineStore.ts | console.error만 | 없음 | P1 |
| DisplaySettings.tsx | console.warn만 | 없음 | P1 |
| Leaderboard.tsx | console.warn만 | 없음 | P1 |

#### CRUD 후 전체 리스트 재로드

| 스토어 | 패턴 | 위험도 |
|--------|------|--------|
| routineStore | addStep/removeStep/swapOrder 후 매번 loadSteps() | P1 |
| gameProfileStore | create/update/delete 후 매번 loadProfiles() | P1 |

---

## 3. 이슈 위험도별 정렬

### P0 (3건)

| # | 파일 | 설명 |
|---|------|------|
| 1 | App.tsx (1,183줄) | 초대형 컴포넌트 — 라우팅+상태+콜백 모두 집중, 분리 필수 |
| 2 | ScenarioSelect.tsx:152 | invoke 에러 핸들링 완전 누락 |
| 3 | stores/ 전체 | invoke 에러 시 UI 피드백 없음 (silent fail) |

### P1 (18건)

| # | 카테고리 | 파일 | 설명 |
|---|---------|------|------|
| 4 | 에러처리 | App.tsx:775,787 | cancel_calibration, start_zoom_calibration try-catch 없음 |
| 5 | 에러처리 | Onboarding.tsx:29 | .catch(()=>{}) 완전 silent |
| 6 | 에러처리 | CommunityShare.tsx:44 | 빈 catch 블록 |
| 7 | 상태관리 | sessionStore + App.tsx | 세션 결과 중복 관리 |
| 8 | useEffect | App.tsx:84 | loadFromDb 무한 루프 위험 |
| 9 | useEffect | RoutinePlayer.tsx:24-47 | interval 재생성 루프 위험 |
| 10 | 타입 | App.tsx:826 | invoke\<any\> 사용 |
| 11 | 타입 | PerformanceLandscape.tsx:130-131 | D3 as any (2건) |
| 12 | 타입 | ProgressDashboard.tsx:75 | as unknown as 체인 |
| 13 | 타입 | App.tsx:618-705 | 연속 as number 캐스팅 |
| 14 | 성능 | AimDnaResult RadarChart | D3 차트 memo 미적용 |
| 15 | 성능 | PerformanceLandscape | D3 차트 memo 미적용 |
| 16 | 통신 | stores/ 전체 (18개) | safeInvoke 미사용 (직접 invoke 51+건) |
| 17 | 통신 | routineStore | CRUD 후 전체 리스트 재로드 |
| 18 | 통신 | gameProfileStore | CRUD 후 전체 리스트 재로드 |
| 19 | 통신 | stores 5개 | invoke 에러 → console.error만 (UI 피드백 없음) |
| 20 | 복잡도 | ScenarioSelect.tsx (504줄) | 18개 상태 변수 + 다중 탭 시스템 |
| 21 | 복잡도 | MovementEditor.tsx (487줄) | 11개 상태 변수 |

### P2 (8건)

| # | 카테고리 | 설명 |
|---|---------|------|
| 22 | 데드코드 | CrosshairLegacy export 미사용 |
| 23 | 타입 | JSON 파싱 후 as 캐스팅 (settingsStore 등) |
| 24 | 타입 | Object.keys() as Type[] 패턴 |
| 25 | 성능 | React.memo 전체 미적용 (49개) |
| 26 | 성능 | Virtualization 미적용 (현재 데이터 규모 소) |
| 27 | 상태 | Props drilling 3단계 (App → ScenarioSelect → Calibration) |
| 28 | 상태 | 로컬 폼 state와 스토어 state 중복 (GameProfileManager 등) |
| 29 | 타입 | Material 캐스팅 (engine/Target.ts) |

---

## 4. 강점

- ErrorBoundary 최상위 적절히 구현됨 ✅
- safeInvoke 래퍼 존재하여 기본 에러 처리 인프라 있음 ✅
- crashReporter 전역 에러 핸들러 ✅
- Zustand 스토어 18개로 관심사 적절히 분리 ✅
- 순환 import 없음 ✅
- 주석처리 코드 / 미사용 import 거의 없음 ✅

---

## 5. 미점검 영역 (세션 3에서 진행)

- [ ] Three.js 엔진 (WebGL 메모리, dispose, FOV 계산)
- [ ] 시나리오 시스템 (28개 시나리오, 랜덤 시드)
- [ ] GP 알고리즘 정합성 상세 (경계 조건, 극단값)
- [ ] 마우스 입력 정확도/지연 상세
- [ ] cm/360 ↔ 내부 감도 변환 정확성
