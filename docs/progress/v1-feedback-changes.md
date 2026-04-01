# v1 프로토타입 피드백 이후 변경사항

> 날짜: 2026-04-02
> 범위: v0.1.0 런칭 이후 master에 머지된 모든 변경사항

---

## 1. UX/메뉴 구조 개편

### 배경
- v1 프로토타입 피드백에서 메뉴 구조, 핵심 컨셉 미노출, UI 일관성 문제 지적
- 상세 피드백: `docs/progress/ux-redesign-feedback.md`

### 변경 내용

**메뉴 구조 3탭 전환**

| Before | After |
|--------|-------|
| `[Training] [Quick Play] [Crosshair] [Tools]` | `[감도 프로파일] [훈련] [분석]` |

- **퀵플레이 제거** — "감도를 깎으러 온 사람"이라는 핵심 페르소나에 집중
- **감도 최적화가 메인 흐름** — 프로파일 생성 CTA를 최상단에 배치
- **크로스헤어** — 독립 탭에서 collapsible 패널로 분리
- **도구들** — 분석/감도 변환/장비 환경/기타로 카테고리 정리

### 수정 파일
- `src/components/ScenarioSelect.tsx` — 메뉴 구조 전면 재작성
- `src/App.tsx` — 라우팅 + 탭 구조 변경
- `src/styles.css` — 탭 스타일, 글래스모피즘, 디자인 시스템 (~500줄 추가)

---

## 2. ProfileWizard 8단계 가이드 플로우

### 개요
신규 사용자가 "프로파일 생성" 버튼 하나로 감도 프로파일 전체를 완성할 수 있는 가이드 플로우.

### 8단계 플로우

| 단계 | 화면 | 설명 |
|------|------|------|
| 1 | Welcome | 소개 + 시작 |
| 2 | 게임 설정 | 주력 게임 + 현재 감도 입력 |
| 3 | 하드웨어 | DPI + 모니터 해상도/Hz |
| 4 | 캘리브레이션 | GP 기반 초기 감도 최적화 |
| 5 | 풀 어세스먼트 | 8개 시나리오 배터리 수행 |
| 6 | 분석 | Aim DNA 레이더 + GP 감도 추천 |
| 7 | 리테스트 | 약점 시나리오 재측정 |
| 8 | 완료 | cm/360 결과 + 크로스게임 변환 |

### 상태 관리
- `profileWizardStore.ts` (Zustand) — 단계 진행, 사용자 입력, 결과 데이터 관리
- 단계별 완료 조건 검증 + 이전 단계로 돌아가기 지원

### 수정 파일
- `src/components/ProfileWizard.tsx` — 신규 (753줄)
- `src/stores/profileWizardStore.ts` — 신규 (314줄)
- `src/App.tsx` — 위자드 라우트 추가

---

## 3. 시나리오 버그 수정

### 문제
타겟 좌표가 **월드 고정 좌표**로 설정되어 있어, 카메라 회전과 무관하게 타겟 위치가 변하지 않는 버그.

### 수정
타겟 좌표를 **카메라 상대좌표** 기반으로 변경. 카메라 방향 기준으로 타겟이 올바른 각도에 스폰.

### 적용 시나리오 (8개)
- `FlickMicroScenario.ts`
- `FlickMediumScenario.ts`
- `FlickMacroScenario.ts`
- `SwitchingCloseScenario.ts`
- `SwitchingWideScenario.ts`
- `TrackingCloseScenario.ts`
- `TrackingMidScenario.ts`
- `TrackingLongScenario.ts`

---

## 4. 사격 피드백 시스템

### 오디오 (`src/engine/AudioManager.ts`)
- Web Audio API 기반 절차적 사운드 생성
- **발사음**: 노이즈 버스트 + 저주파 펀치 (OscillatorNode + GainNode envelope)
- 별도 AudioContext 관리 (사용자 인터랙션 후 활성화)

### 시각 피드백 (`src/components/overlays/ShootingFeedback.tsx`)
- **히트마커**: X 형태 — 명중 시 표시, CSS 애니메이션으로 페이드 아웃
- **미스마커**: O 형태 — 빗맞춤 시 표시
- **머즐플래시**: 화면 밝기 펄스 CSS 애니메이션
- 오버레이로 Three.js 캔버스 위에 렌더링

### 수정 파일
- `src/engine/AudioManager.ts` — 신규 (47줄)
- `src/components/overlays/ShootingFeedback.tsx` — 신규 (83줄)
- `src/engine/GameEngine.ts` — AudioManager + ShootingFeedback 연동
- `src/styles.css` — 히트마커/머즐플래시 애니메이션

---

## 5. 반동 시스템

### 프리셋

| 프리셋 | 수직 반동 | 수평 반동 | 회복 속도 |
|--------|-----------|-----------|-----------|
| light (권총) | 낮음 | 최소 | 빠름 |
| heavy (라이플) | 높음 | 중간 | 보통 |
| shotgun (산탄총) | 매우 높음 | 높음 | 느림 |

### 구현
- **카메라 적용**: pitch(수직) + yaw(수평) 반동을 카메라 회전에 직접 적용
- **시간 기반 회복**: 프레임당 자동 회복 (recoil recovery rate)
- **ON/OFF 토글**: engineStore에서 반동 활성화 상태 관리
- `GameEngine.ts` 내 반동 로직 통합

---

## 6. 총기 뷰모델 + 발사 모드 시스템

### 총기 뷰모델 (`src/engine/WeaponViewModel.ts`)
- Three.js **프로시저럴 메시** — 런타임에 지오메트리 생성 (외부 모델 파일 불필요)
- **2종 모델**: 권총 (compact), 라이플 (elongated barrel + magazine)
- **별도 오버레이 씬/카메라**: 월드 오브젝트에 가려지지 않도록 독립 렌더 패스
- **발사 애니메이션**: 반동 킥백 + 부드러운 복귀 (lerp)
- 418줄 신규

### 발사 모드 (`src/engine/FireModeController.ts`)

| 모드 | 동작 | 설명 |
|------|------|------|
| Semi (단발) | 클릭당 1발 | 기본값 |
| Auto (연발) | 마우스 홀드 시 연속 발사 | RPM 기반 간격 |
| Burst (점사) | 클릭당 3발 연사 | 자동 카운트 |

- **RPM 기반 연사 간격**: 밀리초 단위 제어 (`60000 / RPM`)
- **조작**: B키 또는 UI 드롭다운 (`FireModeIndicator.tsx`)으로 모드 전환
- 144줄 신규

### UI 인디케이터 (`src/components/overlays/FireModeIndicator.tsx`)
- 현재 발사 모드 + 다음 모드 표시
- 드롭다운 UI로 직접 모드 선택 가능
- 32줄 신규

### 수정 파일
- `src/engine/WeaponViewModel.ts` — 신규 (418줄)
- `src/engine/FireModeController.ts` — 신규 (144줄)
- `src/components/overlays/FireModeIndicator.tsx` — 신규 (32줄)
- `src/engine/GameEngine.ts` — 뷰모델 + 발사모드 통합
- `src/stores/engineStore.ts` — 발사모드/뷰모델 상태 추가 (58줄 변경)

---

## 7. 게임 감도 DB 대규모 확장

### 규모
- 기존 10개 → **50+ 게임** 메타데이터
- `src/data/gameDatabase.ts` (1,179줄 신규) + `src-tauri/src/game_db/mod.rs` 확장 (183줄 변경)

### 메타데이터 구조 (게임당)
| 필드 | 설명 |
|------|------|
| yaw | 엔진 회전 계수 |
| defaultFov | 기본 FOV |
| engine | 게임 엔진 (Source2, Unreal, Unity 등) |
| adsMultiplier | ADS 배율 |
| sensitivityField | 게임 내 감도 설정 필드명 |
| category | FPS, TPS, Battle Royale 등 |

### Tier1 교차검증 (11개)
CS2, Valorant, Apex Legends, PUBG, Overwatch 2, Fortnite, Escape from Tarkov, Deadlock, Call of Duty, Rainbow Six Siege, Team Fortress 2

- 각 게임의 yaw 값을 실측 또는 공식 문서 기반으로 검증

### ConversionSelector 검색 UI
- 게임 이름 필터링 검색 입력 필드 추가
- 50+ 게임 목록에서 빠르게 원하는 게임 찾기

### 수정 파일
- `src/data/gameDatabase.ts` — 신규 (1,179줄)
- `src-tauri/src/game_db/mod.rs` — 50+ 게임 확장 (183줄 변경)
- `src/components/ConversionSelector.tsx` — 검색 UI 추가

---

## 8. 입력 지연 최소화 + SQLite 최적화

### 입력 지연 최소화
- **QPC (QueryPerformanceCounter) 타임스탬프** 기반 raw input
- 기존 시스템 시간 대신 고해상도 카운터 사용으로 sub-μs 정확도 확보
- `src-tauri/src/input/raw_input.rs` 변경 (42줄)
- `src-tauri/src/input/commands.rs` 변경 (4줄)

### SQLite 통계/최적화 함수
| 함수 | 설명 |
|------|------|
| `weekly_stats` | 주간 통계 집계 쿼리 |
| `archive_old_trials` | 오래된 트라이얼 데이터 아카이브 |
| `optimize_db` | VACUUM + ANALYZE + 인덱스 최적화 |

### 수정 파일
- `src-tauri/src/input/raw_input.rs` — QPC 타임스탬프 (42줄 변경)
- `src-tauri/src/input/commands.rs` — 커맨드 수정 (4줄)
- `src-tauri/src/db/mod.rs` — 통계/아카이브/최적화 함수 (71줄 추가)
- `src-tauri/src/db/commands.rs` — IPC 3개 추가 (37줄)
- `src-tauri/src/lib.rs` — 커맨드 등록 (4줄)

---

## 전체 수정 파일 목록

### 신규 파일 (10개)
| 파일 | 줄 수 | 설명 |
|------|-------|------|
| `src/components/ProfileWizard.tsx` | 753 | 8단계 가이드 플로우 |
| `src/stores/profileWizardStore.ts` | 314 | 위자드 상태 관리 |
| `src/data/gameDatabase.ts` | 1,179 | 50+ 게임 감도 DB |
| `src/engine/WeaponViewModel.ts` | 418 | 프로시저럴 총기 모델 |
| `src/engine/FireModeController.ts` | 144 | 발사 모드 제어 |
| `src/engine/AudioManager.ts` | 47 | 사격 사운드 |
| `src/components/overlays/ShootingFeedback.tsx` | 83 | 히트/미스마커 |
| `src/components/overlays/FireModeIndicator.tsx` | 32 | 발사 모드 UI |
| `docs/progress/ux-redesign-feedback.md` | 93 | UX 피드백 기록 |
| `docs/progress/v1-feedback-changes.md` | — | 본 문서 |

### 주요 수정 파일 (16개)
| 파일 | 변경 규모 | 설명 |
|------|-----------|------|
| `src/styles.css` | +2,364줄 | 디자인 시스템 + 글래스모피즘 |
| `src/components/ScenarioSelect.tsx` | 전면 재작성 | 3탭 메뉴 구조 |
| `src/engine/GameEngine.ts` | +155줄 | 피드백/반동/뷰모델/발사모드 통합 |
| `src-tauri/src/game_db/mod.rs` | +183줄 | 50+ 게임 확장 |
| `src/App.tsx` | +94줄 | 라우팅 + 위자드 연동 |
| `src/stores/engineStore.ts` | +58줄 | 발사모드/뷰모델 상태 |
| `src-tauri/src/db/mod.rs` | +71줄 | 통계/최적화 함수 |
| `src-tauri/src/db/commands.rs` | +37줄 | IPC 3개 |
| `src-tauri/src/input/raw_input.rs` | +42줄 | QPC 타임스탬프 |
| 8개 시나리오 파일 | 각 6~22줄 | 카메라 상대좌표 수정 |

### 인라인 스타일 제거 (10개 컴포넌트)
`ConversionSelector`, `CrossGameComparison`, `MovementEditor`, `StyleTransition`, `ProgressDashboard`, `FovComparison`, `HardwareCompare`, `TrajectoryAnalysis`, `RecoilEditor`, `TrainingPrescription`

---

## 관련 커밋

```
ca70d0e 총기 뷰모델 + 발사모드 시스템 구현
fe19a2b Expand game sensitivity database to 50+ titles with search UI
c4a8c1b Merge: 프로파일 가이드 플로우 — ProfileWizard 8단계 온보딩
ef35021 Merge: UX + 버그 수정 — 시나리오 버그 + 사격 피드백 + 반동 시스템
4f6e804 Merge: 입력 지연 최소화 + SQLite 통계 최적화
```
