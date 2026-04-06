# AimForge — FPS 에임 교정/훈련 데스크탑 앱

> Tauri 2 (Rust + React + Three.js). GP Bayesian Optimization 감도 최적화.
> 디자인 시스템: **Cold Forge** — 프로스트 블루 (#4A9EDE) 기반 금속/크롬 테마

## 필독 규칙
- **한국어 주석** 필수 (함수, 복잡한 로직, 분기)
- 커밋 메시지 **한국어**
- 파일 수정 전 변경 내용 먼저 보고
- 돌이킬 수 없는 작업은 반드시 먼저 물어보기
- 버그: **증거 먼저, 수정 나중. 한 번에 하나만**
- 컨텍스트 70-80% 차면 세션 교체 — 교체 전 MEMORY.md + `docs/progress/status.md` 업데이트

## 빌드
```bash
npx tauri dev           # 개발 서버
npx tauri build         # 프로덕션 빌드
cd src-tauri && cargo test  # Rust 테스트
npm run build           # 프론트엔드만
```

## 프로젝트 구조

### 프론트엔드 (`src/`)
```
src/
├── components/          # React 컴포넌트 (55+)
│   ├── dashboard/       # SensitivityTab, TrainingTab, AnalysisTab
│   ├── screens/         # ResultScreen, WelcomeScreen, SplashScreen, GPChart 등
│   ├── overlays/        # Crosshair, HUD(Timer/Score/Stats/Accuracy), ScopeOverlay, ShootingFeedback
│   ├── transitions/     # PageTransition, CountdownTransition, ElementTransition
│   └── wizard/          # ProfileWizard 8단계 (Welcome→Game→Hardware→Assessment→Calibration→Analysis→Retest→Complete)
├── engine/              # Three.js 게임 엔진
│   ├── GameEngine.ts    # 메인 게임 루프, 렌더러
│   ├── SoundEngine.ts   # Web Audio API 프로시저럴 사운드 합성
│   ├── WeaponSystem.ts  # 총기 시스템 (발사, 반동 패턴)
│   ├── WeaponViewModel.ts # 1인칭 뷰모델 (권총/라이플, 반동 킥백)
│   ├── Environment.ts   # 3D 환경 (바닥, 벽, 조명)
│   ├── Target.ts        # 구체 타겟
│   ├── HumanoidTarget.ts # 인체형 타겟
│   ├── TargetManager.ts # 타겟 스폰/관리
│   ├── HitDetection.ts  # 히트 판정
│   ├── InputHandler.ts  # 마우스/키보드 입력
│   ├── PointerLock.ts   # 포인터 락
│   ├── scenarios/       # 시나리오 20+ (Flick, Tracking, Zoom 등)
│   └── metrics/         # CompositeScore, MetricsCollector, VelocityTracker 등
├── stores/              # Zustand 상태 관리 (21개)
│   ├── settingsStore.ts # DPI, 감도, 크로스헤어, 사운드 설정
│   ├── gameProfileStore.ts # 게임별 감도 프로필 (DB 연동)
│   ├── engineStore.ts   # 엔진 상태
│   ├── calibrationStore.ts # GP 캘리브레이션 상태
│   ├── batteryStore.ts  # Aim DNA 배터리
│   └── uiStore.ts       # UI 상태, 언어, 테마
├── config/              # constants.ts, theme.ts, scenarioConstants.tsx
├── hooks/               # React 커스텀 훅 (9개)
├── i18n/                # ko.json, en.json
├── data/gameDatabase.ts # 59개 게임 데이터 (감도 필드, FOV 등)
└── styles.css           # Cold Forge 디자인 시스템 (7400+ 줄)
```

### 백엔드 (`src-tauri/src/`)
```
src-tauri/src/
├── db/                  # SQLite DB (profiles, sessions, settings, game_profiles)
│   ├── mod.rs           # 스키마 정의, 마이그레이션
│   ├── commands.rs      # IPC 커맨드 (CRUD + 설정 저장/조회)
│   ├── profiles.rs      # 게임 프로필 CRUD
│   ├── sessions.rs      # 세션 기록
│   ├── calibration.rs   # 캘리브레이션 결과
│   └── ...
├── gp/                  # Gaussian Process (Bayesian Optimization)
├── calibration/         # 캘리브레이션 로직
├── aim_dna/             # Aim DNA 분석
├── training/            # 트레이닝 시스템
├── game_db/             # 게임 데이터베이스 (Rust)
├── hardware/            # 하드웨어 감지
├── validate.rs          # 입력 검증
└── error.rs             # AppError → PublicError
```

## 디자인 시스템 (Cold Forge)

**기획서**: `docs/planning/cold-forge-ui-redesign.md`

핵심 CSS 변수 (styles.css :root):
- 배경: `--bg-deep` (#0A0E14) → `--bg-base` → `--bg-elevated` → `--surface-low/mid/high`
- 액센트: `--accent-primary` (#4A9EDE 프로스트 블루), `--accent-cyan` (#00D4FF 시안 글로우)
- 텍스트: `--text-primary` (#E2E8F0), `--text-secondary` (#94A3B8), `--text-tertiary` (#64748B)
- 폰트: `--font-ui` (Inter), `--font-heading` (Chakra Petch), `--font-mono` (JetBrains Mono), `--font-display` (Orbitron)
- 금속 그라디언트: `--gradient-metal-panel`, `--gradient-chrome-edge`, `--gradient-metal-button`

**절대 금지**: 하드코딩 HEX — 반드시 CSS 변수 사용

## 코딩 규칙

### Rust
- `unwrap()`/`expect()` 금지 (prod). `map_err` + `?` 패턴 사용
- clippy 경고 0 유지
- 모든 IPC 커맨드에 `validate::` 입력 검증
- 에러는 `AppError` → `PublicError` 통일
- DB 스키마 변경 시 시드 데이터 동반 확인

### TypeScript
- `any` / `as any` 금지 (불가피 시 `// eslint-disable-next-line` + 사유 주석)
- 모든 함수에 return type 명시
- 하드코딩 hex 금지 — CSS 변수 사용 (`styles.css` :root 참조)
- 모든 데이터 시각화에 동적 애니메이션 필수 (정적 렌더링 금지)

### 공통
- 새 파일 → 테스트 동반 필수
- 빈 catch 블록 금지 — 최소 `console.error` 또는 로깅
- 500줄 초과 파일 금지 — 분리
- 외부 의존성 추가 시 `npm audit` / `cargo audit` 통과 확인

## 핵심 데이터 흐름

### 게임 프로필
```
Onboarding → createProfile(IPC) → user_game_profiles 테이블
GameProfileManager → CRUD (IPC) → setActive → settingsStore 동기화
```
- `gameProfileStore.ts`의 `GameProfile` 인터페이스 ↔ Rust `GameProfileRow` 1:1 매핑
- `sensFieldsJson` (TS) = `keybinds_json` (Rust) — 필드명 차이 주의
- `profileId: 1` 하드코딩 — 싱글유저 설계 (의도적)

### GP 캘리브레이션
```
활성 프로필 → get_next_trial_sens → 시나리오 실행 → submit_trial → GP 업데이트 → 반복 → finalize
```

### 설정 저장
```
save_user_setting(key, value) / get_all_user_settings → user_settings 테이블
```

## Docs
- `docs/planning/cold-forge-ui-redesign.md` — Cold Forge 디자인 시스템 전체 기획 (컬러, 타이포, 인터랙션, 레이아웃, Three.js, 사운드)
- `docs/planning/v03-master-roadmap.md` — v0.3 마스터 로드맵 (Block A~E)
- `docs/planning/ux-overhaul.md` — UX 개편 설계
- `docs/research/sound-engine-spec.md` — 사운드 엔진 딥리서치 기획서
- `docs/architecture/` — 시스템 설계, DB 스키마, 시나리오
- `docs/progress/` — 진행 현황, 인시던트 로그
- `docs/quality/` — 코딩 규칙, 트러블슈팅, 감사 프레임워크
- `docs/security-audit.md` — 보안 감사 보고서

## 현재 진행 상태 (v0.3)

**완료**: v0.2.0 릴리즈, Phase 1 게임 프로필, Cold Forge 1차 적용, 설정 화면 10개 섹션
**진행 중**: A-2 컴포넌트 인터랙션 애니메이션, 사운드 엔진 고도화 기획

로드맵: `docs/planning/v03-master-roadmap.md` 참조

## 세션 종료 전
- `docs/progress/status.md` + MEMORY.md 업데이트
