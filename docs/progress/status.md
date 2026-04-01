# AimForge 구현 진행 현황

> 마지막 업데이트: 2026-04-02 (P0 Fix Sprint 완료 — 런치 준비 완료)

---

## 완료 현황

### Week 1 — Foundation + Core Calibration (Day 1~7) ✅
- **Day 1~2**: Tauri 2 + React + TS 인프라, WinAPI raw input, DPI 검증, SQLite 전체 스키마
- **Day 3~4**: Three.js 엔진, PerspectiveCamera, 스코프 오버레이, 타겟 시스템, 오디오, Static Flick, Linear Tracking, 클릭 타이밍 메트릭, 운동체계 분류
- **Day 5~6**: GP Bayesian Optimization (Matérn 5/2), 2-stage 캘리브레이션, 3-mode, Fatigue/Warmup 감지, Click timing 보정
- **Day 7**: Go/No-Go 5회 반복 재현성 검증

### Week 2 — Scenarios + Game DB + Landscape + Zoom (Day 8~14) ✅
- **Day 8~9**: 시나리오 확장 (Circular/Stochastic Tracking, Counter-Strafe Flick, Micro-Flick, Zoom 3-phase, 배터리 시스템)
- **Day 10~11**: Game DB 10개 프리셋, 6가지 변환 방식, k-parameter, sens_step 스냅
- **Day 12~13**: Performance Landscape (D3), Deep/Obsessive 모드, Zoom Calibration (dual-phase GP + k 피팅), Conversion Method Comparator
- **Day 14**: 교차 테스트 + yaw 실측 검증

### Week 3 — DNA + Cross-game (Day 15~17) ✅
- **Day 14~15**: Aim DNA 23피처 산출 엔진 (Fitts Law, motor 분석, direction bias, type_label 분류), IPC 5개, Battery 자동 진행 (7개 시나리오 큐), BatteryResult + AimDnaResult (D3 레이더), SessionHistory
- **Day 16~17**: DataSufficiency (피처별 min threshold), DNA 시계열 변화 감지 (analyze_dna_trend), Reference Game 자동 감지 (detect_reference_game), crossgame 백엔드 보완 (reference_game_id + sens_diff_cm360), CrossGameComparison.tsx (듀얼 레이더 + 델타 + 원인 + 타임라인), radarUtils.ts, crossGameStore.ts

### Day 18~19: 훈련 처방 + 궤적 분석 + Progress Dashboard ✅
- **Phase 1**: DB CRUD 보강 — ReadinessScoreRow/StyleTransitionRow 구조체 + CRUD 8개, submit_stage_result에 daily_stats/skill_progress 자동 집계 연결
- **Phase 2**: 궤적 분석 모듈 — ClickVector 추출(200ms lookback), GMM 2-Component EM (from scratch), Bhattacharyya separation_score, 감도 진단 (overshoot 비율 + 종료속도), IPC 2개
- **Phase 3**: Game Readiness Score — 마이크로 테스트 기반 baseline 대비 컨디션 점수 (0.3*flick+0.2*ttt+0.3*tracking+0.2*vel), 4단계 카테고리별 한국어 어드바이스. Style Transition — 4단계 Phase (initial→adaptation→consolidation→mastery), 수렴도 추적, plateau 감지, IPC 5개
- **Phase 4**: Cross-game 갭→처방 연동 (5개 갭 원인→시나리오 매핑), TS 타입 ~120줄 추가
- **Phase 5**: Frontend Stores — trainingStore.ts (처방+readiness+styleTransition), progressStore.ts (dailyStats+skillProgress+dnaTimeSeries+trajectoryAnalysis)
- **Phase 6**: Frontend 컴포넌트 5개 — TrainingPrescription (처방 카드+필터), ProgressDashboard (Readiness 게이지+DNA 시계열 D3 라인차트+스킬 진행 그리드), ReadinessWidget (D3 arc 게이지), TrajectoryAnalysis (산점도+GMM 히스토그램+감도 진단), StyleTransition (4단계 인디케이터+수렴바+전환폼). App.tsx 라우팅+ScenarioSelect 네비 4개 추가

### Day 20~21: Movement + FOV + Hardware ✅
- **Phase 1**: Movement 모듈 — 10개 게임 프리셋 (max_speed/stop_time/accel_type/air_control/cs_bonus), 가중 추천 공식 (1-r)×static + r×moving, DB CRUD 6개, IPC 6개
- **Phase 2**: FOV 프로파일 모듈 — FOV별 peripheral/center 분리 비교, 추천 규칙 (peripheral 최고 + center 하락 5% 미만), DB CRUD 3개, IPC 4개
- **Phase 3**: Hardware 비교 모듈 — DNA 23피처 델타 (lower_is_better 피처 반전), cm/360 이동 분석, DB CRUD 5개, IPC 5개
- **Phase 4**: TS 타입 ~80줄 추가 (Movement/FOV/Hardware), Zustand 스토어 3개 (movementStore/fovStore/hardwareStore)
- **Phase 5**: React 컴포넌트 4개 — MovementEditor (5슬라이더+프리셋 테이블+가중 추천), FovComparison (결과 테이블+비교 바), HardwareCompare (DNA 델타 테이블+cm/360 이동), DualLandscape (Canvas 이중 라인차트+실시간 ratio 조정)
- **Phase 6**: AppScreen 4개 추가, ScenarioSelect 네비 버튼 4개, App.tsx 라우팅

### Day 22~23: Movement Editor 고도화 + Routine Builder ✅
- **Phase 1**: Movement JSON Export/Import — `MovementExportData` 구조체 (직렬화/검증/변환), IPC 2개 (`export_movement_profile`, `import_movement_profile_from_string`), movementStore 액션 2개, MovementEditor에 내보내기/가져오기 버튼 + `<input type="file">` UI
- **Phase 2**: 5-슬라이더 라이브 프리뷰 — `MovementPreviewPanel` canvas 애니메이션 (이동 점 시뮬레이션, 속도 바, 공중 제어 바, CS 보너스 뱃지)
- **Phase 3**: 실측 캘리브레이션 가이드 — `calculate_max_speed_from_wall_time()`, `get_calibration_distance()` (10개 게임), `calibrate_max_speed` IPC, 단계별 한국어 안내 UI
- **Phase 4**: Routine Builder 순서 변경 — `swap_routine_step_order()` DB 메서드 (UNIQUE 제약 우회 트랜잭션), IPC 1개, ▲/▼ 버튼 UI
- **Phase 5**: 시간 배분 시각화 — `TimeAllocationBar` 컴포넌트 (시나리오별 색상 스택 바 + 범례)
- Rust 테스트 7개 추가 (export roundtrip, serialization, validation, calibration 4개)

### Day 24~25: Session Flow + Recoil Editor + Conversion Selector + UX Polish ✅
- **Phase 1**: UX 기반 — Toast 알림 시스템 (toastStore + Toast 컴포넌트), safeInvoke IPC 래퍼, LoadingSpinner/BackButton 공통 컴포넌트, 화면 전환 CSS 애니메이션
- **Phase 2**: Session Flow 통합 — Quick Play 결과 DB 저장 (start_session → save_trial → end_session), Training 결과 submit_stage_result 연동, Battery 개별 트라이얼 save_trial + 세션 종료 end_session, sessionStore resetSession 추가
- **Phase 3**: Recoil Pattern CRUD — recoil_commands.rs (IPC 4개: get/save/update/delete_recoil_pattern), db/mod.rs RecoilPatternRow 구조체 + CRUD 4개, lib.rs 등록
- **Phase 4**: RecoilEditor UI — SVG 패턴 시각화 (포인트 드래그/추가/삭제), 빌트인 프리셋 + DB 커스텀 패턴 목록, RPM/randomness/vertical/horizontal 슬라이더, 스프레이 미리보기 애니메이션
- **Phase 5**: ConversionSelector — 10개 게임 쌍 선택 + 스왑, 6가지 변환 방식 결과 테이블 (MDM 0/56.25/75/100%, Viewspeed H/V), 게임 카테고리별 추천 하이라이트, 감도 스냅 (floor/ceil/recommended), 클립보드 복사
- **Phase 6**: App.tsx 라우팅 — recoil-editor, conversion-selector 스크린 추가, 퀵 네비게이션 버튼 2개

### Day 26~27: UX Polish + Mode + Onboarding + Theme + i18n ✅
- **Phase 1**: uiStore — AppMode(simple/advanced), AppTheme(dark/light), AppLocale(ko/en), onboardingCompleted 상태 + user_settings DB 영속화
- **Phase 2**: 다크/라이트 테마 — `[data-theme="light"]` CSS 변수 오버라이드 9개, body transition, 헤더 테마 토글 버튼
- **Phase 3**: Simple/Advanced 모드 — screenAccess.ts (ADVANCED_ONLY_SCREENS Set), ScenarioSelect.tsx 고급 도구 버튼 조건부 렌더링, App.tsx 퀵네비 조건부 + 모드 가드 (Advanced 화면→settings 리다이렉트), 헤더 모드 pill 스위치
- **Phase 4**: 온보딩 5단계 위자드 — Onboarding.tsx (환영→DPI→게임선택→감도→완료+모드선택), App.tsx 온보딩 게이트
- **Phase 5**: i18n 인프라 — useTranslation() 커스텀 훅, ko.json/en.json (~50키), fallback 체인 (locale→ko→key)
- **Phase 6**: 빌드 검증 — npm build 성공 (1,082 kB), Rust 147/147 통과, TS 에러 0

### Day 28~29: 버그 픽스 + 엣지 케이스 + 빌드 검증 ✅
- **Bug 1**: training/commands.rs — JSON 직렬화 `unwrap_or_default()` → 에러 전파 (`scenario_params`, `difficulty`, `baseline_delta`)
- **Bug 2**: crossgame/commands.rs — 처방 DB 저장 `unwrap_or_default()` + `.ok()` → `log::warn!` 경고 로그, compare_game_dna 직렬화도 에러 전파
- **Bug 3**: zoom_calibration/mod.rs + commands.rs — `ZoomRatioResult`에 `zoom_profile_id` 필드 추가, 하드코딩 `0` 제거
- **Bug 4**: zoom_calibration/comparator.rs + commands.rs — `ComparatorEngine`에 `multipliers` 필드, `MethodScore`에 `multiplier_used` 필드 추가, 하드코딩 `0.0` 제거
- **Bug 5**: training/commands.rs — `upsert_daily_stat`/`upsert_skill_progress` `.ok()` → `log::warn!`
- **Bug 6**: training/commands.rs — `complete_style_transition` `.ok()` → 에러 전파 (데이터 무결성)
- **Bonus**: zoom_calibration/commands.rs — k_fit 직렬화 `unwrap_or_default()` → 에러 전파
- **TODO 1**: App.tsx — `TrainingPrescription.onTrainingStart` → `handleTrainingStart` 연동 (처방에서 바로 훈련 시작)
- **TODO 2**: ZoomCalibrationSetup.tsx — game_id 매핑 주석 개선 (DB 시드 인프라 필요, 향후 과제)
- **TS 타입 동기화**: zoomCalibrationStore.ts — `MethodScore.multiplier_used` 필드 추가
- 빌드 검증: Rust 147/147 통과, npm build 성공 (1,082 kB), TS 에러 0

### 헬스체크 세션 3: GP 엔진 + Three.js ✅
- **GP 엔진**: P0 3건 (NaN 크래시 체인: assert release 비활성 + expect panic + unwrap panic)
- **Three.js**: P0 3건 (setTimeout 미정리 6개 시나리오 + 익명 이벤트 리스너 누적 2건)
- **P1 9건, P2 9건** — 상세: `docs/health/AIMFORGE_HEALTH_03_GP_THREEJS.md`
- 누적 P0: 14건 (세션1: 5 + 세션2: 3 + 세션3: 6)

### 헬스체크 세션 4: 종합 리포트 + 런치 판정 ✅
- **신규 P0 1건**: zoom_calibration/comparator.rs:228 — partial_cmp().unwrap() NaN panic
- **신규 P1 10건**: trajectory cm360 0 나눗셈, conversion.rs 부동소수점 == 0.0, raw_input 레이스 컨디션 등
- **런치 판정: 조건부 GO** — P0 Fix Sprint (~4-5시간) 후 런칭 가능
- 상세: `docs/health/AIMFORGE_HEALTH_FINAL.md`

### P0 Fix Sprint ✅
- **Block A**: GP NaN 크래시 체인 — cholesky_decompose assert→Result, predict expect→graceful fallback, analysis.rs/comparator.rs partial_cmp NaN 방어
- **Block B**: lib.rs expect 3개 → `?` 연산자 에러 전파
- **Block C**: Three.js — 6개 시나리오 setTimeout 저장+dispose 정리, GameEngine 3개 익명 리스너→필드 참조+dispose 제거, capturing 폴백 안전 처리
- **Block D**: 프론트엔드 — fovStore/hardwareStore/movementStore raw invoke→safeInvoke, gameProfileStore/routineStore/DisplaySettings catch에 toast 추가
- **Block E**: conversion.rs 6개 `== 0.0` → `.abs() < EPSILON` (1e-10)
- 빌드 검증: Rust 147/147 통과, npm build 1,083kB, TS 에러 0

---

## 다음 작업

### Day 30: 런칭 준비
- .msi 빌드 + 배포
- GitHub 릴리즈
- README 작성

---

## 빌드 상태

| 항목 | 상태 |
|------|------|
| Rust tests | 147/147 통과 |
| npm build | 성공 (1,082 kB) |
| 타입 에러 | 0 |
