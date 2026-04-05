# AimForge 구현 진행 현황

> 마지막 업데이트: 2026-04-05 (v0.2.0 릴리즈 준비)

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

### Day 30: 런칭 + UX 재설계 ✅
- .msi 빌드 + GitHub 릴리즈 (v0.1.0) 완료
- README.md + LICENSE 작성
- **UX 재설계**: 메뉴 구조 3탭 전환 (프로파일 점검/훈련/도구)
- **UI 폴리싱**: CSS 디자인 시스템, 글래스모피즘, ~440개 인라인 스타일 제거
- 상세: `docs/progress/ux-redesign-feedback.md`

### v1 피드백 이후 기능 확장 (Post-Launch) ✅

#### 1. UX/메뉴 구조 개편
- 메뉴 3탭 구조: 감도 프로파일 | 훈련 | 분석
- 퀵플레이 제거, 감도 최적화가 메인 흐름
- 크로스헤어를 collapsible 패널로 분리
- "프로파일 생성" 메인 진입점

#### 2. ProfileWizard 8단계 가이드 플로우
- Welcome → 게임설정 → 하드웨어(DPI/모니터) → 캘리브레이션 → 풀 어세스먼트(8시나리오) → 분석(Aim DNA + GP 감도추천) → 리테스트(약점 재측정) → 완료(cm/360 + 게임 변환)
- `profileWizardStore.ts` (Zustand) + `ProfileWizard.tsx`

#### 3. 시나리오 버그 수정
- 타겟 좌표: 월드 고정 → 카메라 상대좌표 (8개 시나리오 전부)

#### 4. 사격 피드백 시스템
- 발사음: Web Audio API (noise burst + low-freq punch)
- 시각: 히트마커(X) + 미스마커(O) + 머즐플래시 CSS 애니메이션
- `ShootingFeedback.tsx`, `AudioManager.ts`

#### 5. 반동 시스템
- 3 프리셋: light(권총), heavy(라이플), shotgun
- OFF 토글, 카메라 적용: 수직 + 수평 반동, 시간 기반 회복

#### 6. 총기 그래픽 + 발사 모드
- Three.js 프로시저럴 총기 모델 (권총/라이플), 별도 오버레이 씬/카메라
- 발사 모드: 단발(Semi) / 연발(Auto) / 점사(Burst), RPM 기반 연사 간격
- B키 또는 UI 드롭다운으로 전환
- `FireModeController.ts`, `WeaponViewModel.ts`, `FireModeIndicator.tsx`

#### 7. 게임 감도 DB 대규모 확장
- 50개 게임 메타데이터 (yaw, FOV, 엔진, ADS, 감도필드)
- Tier1 11개 교차검증 (CS2, Valorant, Apex, PUBG, OW2, Fortnite, Tarkov, Deadlock, CoD, R6S, TF2)
- `gameDatabase.ts` + Rust `game_db/mod.rs` 50+개 확장, ConversionSelector 검색 UI

#### 8. 입력 지연 최소화 + SQLite 최적화
- QPC 타임스탬프 기반 raw input
- `weekly_stats`, `archive_old_trials`, `optimize_db` 함수

- 상세: `docs/progress/v1-feedback-changes.md`

---

## 다음 작업

### Aim DNA 버그 수정 ✅ (2026-04-02)
- `AimDnaProfile::adaptation_rate` 제거 — `fatigue_decay = -adaptation_rate` 수학적 중복 피처
- 수정 파일: aim_dna/mod.rs, db/mod.rs, training/style_transition.rs, types.ts, AimDnaResult.tsx, HardwareCompare.tsx
- `calibration::ScreeningData::adaptation_rate`, `crossgame::adaptation_rate`는 다른 컨텍스트로 유지

### 히트박스 3구역 확장 ✅ (2026-04-02) [claude/sweet-cartwright → master]
- `HumanoidTarget.ts`: 히트존 2구역(head/body) → 3구역(head/upper_body/lower_body)
- `TargetManager.ts`: HumanoidTarget 생성 로직 3구역 반영
- `FlickScenario.ts`, `CounterStrafeFlickScenario.ts`: 3구역 히트 판정 업데이트
- `types.ts`: HitZone 타입 확장

### DNA 히스토리 + 전후 비교 시스템 ✅ (2026-04-02)
- **Rust DB**: `aim_dna_snapshots` 테이블 — 매 DNA 측정마다 5축 점수 자동 저장
- **Rust DB**: `aim_dna_change_events` 테이블 — 기어/감도/그립/자세 변경점 태깅
- **Rust 헬퍼**: `compute_radar_axes()` — TS `radarUtils.ts`와 동일 공식 (Rust/TS 일관성)
- **compute_aim_dna_cmd 자동화**: 배터리 완료 → 스냅샷 자동 저장
- **IPC 5개**: `get_dna_snapshots_cmd`, `save_change_event_cmd`, `get_change_events_cmd`, `compare_snapshots_cmd`, `detect_stagnation_cmd`
- **types.ts**: `DnaSnapshot`, `DnaChangeEvent`, `AxisDelta`, `SnapshotComparison`, `StagnationResult` 타입 추가
- **aimDnaStore.ts**: `snapshots/changeEvents/comparison/stagnation` 상태 + 5개 액션 추가
- **AimDnaHistory.tsx**: 타임라인 D3 라인차트 + 변경점 수직 마커 + 스냅샷 비교 + 레이더 오버레이 + 정체기 배너
- **AimDnaResult.tsx**: `history` 탭 추가 (총 6탭)

### 기어 DB + 그립/자세 가이드 + 인사이트 엔진 ✅ (2026-04-02)
- `src/data/gearDatabase.json`: 마우스 51개 / 마우스패드 35개 실데이터
- `AimDnaSensitivitySelector.tsx`: 자동완성 검색 기어 선택기 (gearDatabase.json 연동)
- `AimDnaGripGuide.tsx`: Palm/Claw/Fingertip/Relaxed Claw 바이오메카닉스 상세 + SVG 일러스트 + DNA 연관 지표
- `AimDnaPostureGuide.tsx`: 고감도/중감도/저감도 자세 가이드 (피벗 포인트 / 팔꿈치 / 패드 크기 / 리프트오프)
- `AimDnaInsights.tsx`: 기어+DNA 조합 인사이트 엔진 (달인급 80+ 전용 expert 모드 포함)
- `AimDnaResult.tsx`: 5탭 구조 (분석결과/기어선택/그립/자세/인사이트)

- ReadinessWidget, DualLandscape 등 남은 컴포넌트 인라인 스타일 정리
- 프로파일 점검 탭에 실제 DNA 데이터 연동 (배터리 완료 → 요약 표시)
- 사용자 테스트 피드백 반영

### P0 디자인 감사 수정 ✅ (2026-04-05) [claude/fervent-dewdney → master]

#### P0-1: 게임 선택 그리드 개선
- **이니셜 아바타**: 48×48 원형, 게임명 첫 2글자, 카테고리별 색상 (FPS=#60a5fa, 전술=#34d399, 배틀로얄=#fbbf24, TPS=#f0913a, 기타=#a78bfa)
- **검색 필드**: 다크 인풋, 한/영 실시간 필터링 (GAME_DATABASE의 nameKo 포함)
- **카테고리 필터 칩**: [전체/FPS/전술 FPS/배틀로얄/TPS/기타] 가로 스크롤, 색상 도트
- **적용 위치**: Onboarding.tsx + ProfileWizard.tsx 양쪽

#### P0-2: 온보딩 단계 전환 애니메이션
- **AnimatePresence + motion**: 다음=좌→우 슬라이드, 이전=우→좌, 0.25s easeInOut
- **DPI 유효성**: 100~32000 범위 밖이면 빨간 테두리 + 에러 메시지
- **감도 유효성**: 0 이하면 에러 표시
- **게임 미선택**: "게임을 선택해주세요" 안내

수정 파일: Onboarding.tsx, ProfileWizard.tsx, styles.css, en.json, ko.json

### P1 디자인 개선 ✅ (2026-04-05) [claude/xenodochial-merkle → master]
- ScenarioSelect: 텍스트 아이콘('///', '~~~', '<->') → 인라인 SVG 아이콘 (18px, currentColor)
- AimDnaResult 레이더 차트: d3.transition() 600ms draw 애니메이션 (중심→실제값, easeOutCubic)
- AimDnaResult + ScenarioSelect: AnimatePresence motion fade 탭 전환 (0.2s)
- EmptyState.tsx 범용 컴포넌트 신규 생성 (icon, title, description, action props + CSS)
- 라이트 테마 glow 변수 opacity 0.15→0.22 (accent, success, info, warning)
- 수정 파일: ScenarioSelect.tsx, AimDnaResult.tsx, EmptyState.tsx (신규), styles.css

### P2 디자인 개선 ✅ (2026-04-05) [claude/funny-kirch → master]
- 하드코딩 색상 → CSS 시맨틱 변수 (--color-hit, --color-miss, --color-amber 등 13개) + 라이트 테마 대응값
- font-size 하드코딩 → 9단계 폰트 스케일 변수 (--font-xs ~ --font-display) 110+ 곳 교체
- font-weight 산발적 사용 → 변수 체계 (--fw-normal ~ --fw-black) 80+ 곳 통일
- 탭 컴포넌트 ARIA 접근성: role="tablist"/"tab", aria-selected 8개 탭그룹 (AimDnaResult, ScenarioSelect, ProgressDashboard 등)
- 아이콘 버튼 aria-label: 테마 토글, 스왑 버튼, 뒤로가기 버튼
- state별 glow 변수 (--glow-accent-sm/md/lg/focus, --glow-success-sm/lg, --glow-danger-sm, --glow-info-sm) 통합
- SessionHeatmap: 밀도 색상 범례 바 (blue→green→yellow→red) + 히트/미스 마커 범례 추가
- 인라인 스타일 하드코딩 색상 CSS 변수화 (AimDnaHistory, DualLandscape, MultiplierCurve 등 15개 컴포넌트)
- 수정 파일: styles.css, App.tsx, 15개 컴포넌트 (17파일 508+/378-)

### 보안 코드 감사 (2026-04-05) [claude/brave-mccarthy]
- 7개 항목 정적 분석 (읽기 전용): IPC, SQLite, XSS, 시크릿, 파일시스템, 의존성, 프라이버시
- **High 1건**: CSP 비활성화 (`tauri.conf.json` `"csp": null`)
- **Medium 1건**: IPC String 파라미터 길이 제한 없음
- **Low 2건**: innerHTML 1건 (숫자 데이터), 크래시 로그 경로 노출 가능
- **안전**: SQL 인젝션 0건 (100% 파라미터 바인딩), API키 하드코딩 0건, npm 취약점 0건, path traversal 방어 적용
- 상세: `docs/security-audit.md`

### 보안 개선 Phase 1 ✅ (2026-04-05) [claude/thirsty-gagarin → master]
- **CSP 강화**: `tauri.conf.json` `"csp": null` → strict 정책 (default-src 'self', unsafe-eval 미포함)
- **devTools**: Release 빌드 기본 비활성화 확인 (Tauri 2 기본값, 추가수정 불필요)
- **Capabilities 세분화**: `core:default` + `log:default` 최소 권한 설정, 설명 한국어화
- **npm audit**: 취약점 0건
- **cargo audit**: 18건 warning — 전부 Tauri 업스트림 전이적 의존성 (GTK3 unmaintained 11건, unic-* unmaintained 5건, proc-macro-error unmaintained 1건, glib unsound 1건). 직접 수정 불가, Tauri 업데이트 시 해소 예정
- 수정 파일: `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`

### 보안 개선 Phase 2 ✅ (2026-04-05) [claude/stoic-poitras → master]
- **error.rs 신규**: `AppError` (내부 에러 5변형: Validation/Database/Lock/NotFound/Internal) + `PublicError` (프론트 전달용: message+code)
- **validate.rs 신규**: 입력값 범위 검증 헬퍼 10개 — DPI(100-32000), sensitivity(>0), FOV(1-179), 문자열(비어있지않음), ID(>=0), score(0-1), cm360(>0), positive_f64, non_negative_f64, zoom_ratio(≥1)
- **PublicError 패턴**: 전체 13개 commands.rs의 반환 타입을 `Result<T, String>` → `Result<T, PublicError>`로 전환
  - DB 경로, SQL 에러 텍스트, 시스템 경로 프론트엔드 노출 차단
  - 내부 에러는 log::error!/log::warn!으로만 기록
  - Validation/NotFound 에러는 사용자 메시지 그대로 전달 (입력 교정 가능)
- **IPC 입력 검증**: 모든 `#[tauri::command]` 진입점에 입력값 범위 검증 추가
- **lock_state() 헬퍼**: Mutex lock 에러 처리 통일 (PoisonError → AppError::Lock)
- **주석 정리**: calibration/screening.rs 방치 TODO 1건 정리
- 수정 파일: 15개 수정 + 2개 신규 (error.rs, validate.rs), 928+/379-

### P3 디자인 감사: 키보드 접근성 + EmptyState + 반응형 ✅
- **키보드 접근성**: `useTabKeyboard` 훅 신규 (ArrowLeft/Right/Home/End + tabIndex 로빙, WAI-ARIA Tabs 패턴)
  - 7개 tablist 적용: AimDnaResult, ScenarioSelect×2, AimDnaGripGuide, ProgressDashboard×2, TrainingPrescription
- **EmptyState 적용**: SessionHistory, ProgressDashboard, TrainingPrescription, AimDnaResult에 아이콘+제목+설명+액션 빈 상태 UI
  - i18n 키 8개 추가 (en.json + ko.json)
- **반응형 레이아웃**: `@media (max-width: 1100px/1000px)` — 그리드 1열 전환, 탭 스크롤, 카드 span 해제
  - tauri.conf.json minWidth 1280→960, minHeight 720→640
- 수정 파일: 10개 수정 + 1개 신규 (useTabKeyboard.ts), 238+/22-

---

### v0.2.0 릴리즈 준비 ✅ (2026-04-05) [claude/sleepy-bardeen → master]
- **CI 보안 감사**: `.github/workflows/security-audit.yml` — cargo audit + npm audit (push/PR/주간 자동 실행)
- **버전 업데이트**: 0.1.0 → 0.2.0 (Cargo.toml, tauri.conf.json, package.json)
- **CHANGELOG.md**: 0.1.0 이후 변경사항 요약 (코드품질, UI디자인, 보안, 기능, CI)

### 줌 캘리브레이션 P2 + P1.5 + P1 (2026-04-05) [claude/jovial-chatterjee]

#### P2: ZoomTier 확장 + 테스트환경 개선
- **ZoomTier 7단계**: `1x/2x/4x/6x/8x/10x/12x` — 각 단계별 거리/타겟크기/속도 그라데이션
- **WeaponSystem 프리셋 추가**: `zoom_6x`(FOV 17°, sens 0.42), `zoom_10x`(FOV 10.3°, sens 0.3), `zoom_12x`(FOV 8.6°, sens 0.25)
- **ZoomMultiFlickScenario**: 4x 고정 → 배율 파라미터로 받도록 수정 (`zoomPreset` 생성자 인자)
- **동적 이동범위 제한**: ±30° 고정 → `min(fov/2 × 0.8, 30)` — ZoomSteady + ZoomMultiFlick 양쪽 적용

#### P1.5: 에이밍 타입별 k 분리
- **Rust k_fitting.rs**: `AimType` enum (Tracking/Flicking/Combined) + `GameZoomProfile` struct + `get_effective_k()` 가중 평균
- **기본 게임 줌 패턴 5종**: CS2 AWP(0/100), Apex 3x(70/30), OW2 아나(90/10), R6 ACOG(40/60), CoD ADS(80/20)
- **fit_k_parameter_with_aim_type()**: aim_type 파라미터 추가 (backward compatible)
- **TS 미러**: `physics.ts`에 `AimType`, `AimTypeKResult`, `GameZoomProfile`, `getEffectiveK()` 추가

#### P1: 크로스게임 줌 감도 변환
- **Rust 커맨드**: `convert_crossgame_zoom_sensitivity` — 소스/타겟 게임, 옵틱, piecewise_k/aim_type_k 지원
- **CrossGameConverter.tsx**: 소스/타겟 게임 선택 + 감도 입력 + 7단계 줌 배율 → 개인 k로 변환 결과 표시
- **ZoomProfileChart.tsx**: 배율 vs k값 SVG 차트 (GPChart 패턴 따름, 측정/보간 포인트 + piecewise 구간 + tracking/flicking k 참조선)

#### 캘리브레이션 모드 네이밍 + 데이터 품질 종료조건
- **ZoomCalibrationMode enum**: Light(3배율/글로벌k) | Standard(5배율/tracking+flicking/piecewise_k) | Deep(7배율/완전 piecewise_k+에이밍타입별)
- **DataQualityStatus**: 전체 정밀도(%), 배율별 "sufficient/needs_more/pending" 상태, GP EI 수렴 + k 분산 임계값 기반
- **ZoomCalibrationStatus 확장**: `calibration_mode` + `data_quality` 필드 추가
- **StartZoomCalibrationParams**: `calibration_mode` 파라미터 추가 ("light"/"standard"/"deep")

수정 파일 11개:
- Rust: `k_fitting.rs`, `zoom_calibration/mod.rs`, `zoom_calibration/commands.rs`, `crossgame/commands.rs`, `lib.rs`
- TS: `types.ts`, `physics.ts`, `ZoomSteadyScenario.ts`, `ZoomMultiFlickScenario.ts`, `WeaponSystem.ts`
- React: `CrossGameConverter.tsx` (신규), `ZoomProfileChart.tsx` (신규)

빌드 검증: Rust 147/147 통과, npm build 성공 (1,447 kB), TS 에러 0

### 줌 캘리브레이션 머지 + 에임 트레이너 DB 추가 ✅ (2026-04-05) [dazzling-moore]

#### Step 1: jovial-chatterjee 워크트리 머지 → master
- 미커밋 변경사항 커밋 후 `claude/jovial-chatterjee` → master no-ff 머지
- 13개 파일 (504+/14-): k_fitting.rs, zoom_calibration/mod.rs, commands.rs, crossgame/commands.rs, lib.rs, CrossGameConverter.tsx, ZoomProfileChart.tsx, WeaponSystem.ts, ZoomSteadyScenario.ts, ZoomMultiFlickScenario.ts, physics.ts, types.ts, status.md

#### Step 2: 에임 트레이너 3개 DB 추가
- **game_db/mod.rs**: Tier1(KovaaK's 2.0, Aim Lab), Tier2(Aiming.Pro) — yaw=0.022, fov=103.0, horizontal
- **gameDatabase.ts**: 동일 3개 + `GameCategory`에 `'trainer'` 타입 추가
- **Onboarding.tsx**: `CATEGORY_COLORS`에 trainer 색상(`#22d3ee`) 추가 (TS 컴파일 에러 수정)
- 빌드 검증: Rust 147/147 통과, npm build 성공 (1,448 kB), TS 에러 0

### Cold Forge UI Phase 1: CSS 변수 + 컬러 팔레트 교체 (2026-04-05) [claude/naughty-germain]

#### :root 전면 교체 — Cold Forge 다크 테마
- **Core Palette**: --bg-deep(#0A0E14), --bg-base(#0F1318), --bg-elevated(#161B22), --surface-low/mid/high, --border-subtle/default/strong
- **Metal & Chrome 6단계**: --metal-steel-dark ~ --metal-silver-white
- **Accent 오렌지→블루**: --accent-primary(#4A9EDE), --accent-cyan(#00D4FF), --accent-ice(#B8E6FF)
- **기존 변수 호환 매핑**: --bg-primary/--bg-secondary/--accent 등 → Cold Forge 토큰 참조 (하위호환)
- **그라디언트 5종**: gradient-metal-panel, gradient-chrome-edge, gradient-cyan-glow, gradient-metal-button, gradient-metal-button-pressed
- **금속 노이즈 텍스처**: SVG feTurbulence 기반 --noise-texture
- **라이트 테마**: accent 오렌지→블루(#3B82F6) 교체

#### 하드코딩 오렌지 색상 일괄 교체
- **styles.css**: rgba(240,145,58,...) 35+곳 → rgba(74,158,222,...), hex #f0913a/#fbbf6a 등 교체
- **컴포넌트 11개**: #f0913a(18곳) → #4A9EDE, #f5a623(9곳) → #6B8DB5 교체
  - AimDnaHistory, AimDnaResult, CrossGameComparison, DualLandscape, Onboarding, ProfileWizard, RecoilEditor, RoutineBuilder, AimDnaPostureGuide, ReadinessWidget, TrajectoryAnalysis
- 빌드 검증: npm build 성공 (1,448 kB), TS 에러 0

### Cold Forge Phase 1 머지 ✅ (2026-04-05) [claude/naughty-germain → master]
- `claude/naughty-germain` → master `--no-ff` 머지
- 13개 파일 (309+/115-): styles.css, 11개 컴포넌트, status.md
- 빌드 검증: npm build 성공 (1,448 kB), TS 에러 0

## 다음 작업

- Cold Forge Phase 2: 레이아웃, 금속 패널, 버튼 스타일링
- 사용자 테스트 피드백 반영
- font-size 하드코딩 → 9단계 폰트 스케일 변수 (--font-xs ~ --font-display) 110+ 곳 교체
- font-weight 산발적 사용 → 변수 체계 (--fw-normal ~ --fw-black) 80+ 곳 통일
- 탭 컴포넌트 ARIA 접근성: role="tablist"/"tab", aria-selected 8개 탭그룹 (AimDnaResult, ScenarioSelect, ProgressDashboard 등)
- 아이콘 버튼 aria-label: 테마 토글, 스왑 버튼, 뒤로가기 버튼
- state별 glow 변수 (--glow-accent-sm/md/lg/focus, --glow-success-sm/lg, --glow-danger-sm, --glow-info-sm) 통합
- SessionHeatmap: 밀도 색상 범례 바 (blue→green→yellow→red) + 히트/미스 마커 범례 추가
- 인라인 스타일 하드코딩 색상 CSS 변수화 (AimDnaHistory, DualLandscape, MultiplierCurve 등 15개 컴포넌트)
- 수정 파일: styles.css, App.tsx, 15개 컴포넌트 (17파일 508+/378-)

### 보안 코드 감사 (2026-04-05) [claude/brave-mccarthy]
- 7개 항목 정적 분석 (읽기 전용): IPC, SQLite, XSS, 시크릿, 파일시스템, 의존성, 프라이버시
- **High 1건**: CSP 비활성화 (`tauri.conf.json` `"csp": null`)
- **Medium 1건**: IPC String 파라미터 길이 제한 없음
- **Low 2건**: innerHTML 1건 (숫자 데이터), 크래시 로그 경로 노출 가능
- **안전**: SQL 인젝션 0건 (100% 파라미터 바인딩), API키 하드코딩 0건, npm 취약점 0건, path traversal 방어 적용
- 상세: `docs/security-audit.md`

### 보안 개선 Phase 1 ✅ (2026-04-05) [claude/thirsty-gagarin → master]
- **CSP 강화**: `tauri.conf.json` `"csp": null` → strict 정책 (default-src 'self', unsafe-eval 미포함)
- **devTools**: Release 빌드 기본 비활성화 확인 (Tauri 2 기본값, 추가수정 불필요)
- **Capabilities 세분화**: `core:default` + `log:default` 최소 권한 설정, 설명 한국어화
- **npm audit**: 취약점 0건
- **cargo audit**: 18건 warning — 전부 Tauri 업스트림 전이적 의존성 (GTK3 unmaintained 11건, unic-* unmaintained 5건, proc-macro-error unmaintained 1건, glib unsound 1건). 직접 수정 불가, Tauri 업데이트 시 해소 예정
- 수정 파일: `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`

### 보안 개선 Phase 2 ✅ (2026-04-05) [claude/stoic-poitras → master]
- **error.rs 신규**: `AppError` (내부 에러 5변형: Validation/Database/Lock/NotFound/Internal) + `PublicError` (프론트 전달용: message+code)
- **validate.rs 신규**: 입력값 범위 검증 헬퍼 10개 — DPI(100-32000), sensitivity(>0), FOV(1-179), 문자열(비어있지않음), ID(>=0), score(0-1), cm360(>0), positive_f64, non_negative_f64, zoom_ratio(≥1)
- **PublicError 패턴**: 전체 13개 commands.rs의 반환 타입을 `Result<T, String>` → `Result<T, PublicError>`로 전환
  - DB 경로, SQL 에러 텍스트, 시스템 경로 프론트엔드 노출 차단
  - 내부 에러는 log::error!/log::warn!으로만 기록
  - Validation/NotFound 에러는 사용자 메시지 그대로 전달 (입력 교정 가능)
- **IPC 입력 검증**: 모든 `#[tauri::command]` 진입점에 입력값 범위 검증 추가
- **lock_state() 헬퍼**: Mutex lock 에러 처리 통일 (PoisonError → AppError::Lock)
- **주석 정리**: calibration/screening.rs 방치 TODO 1건 정리
- 수정 파일: 15개 수정 + 2개 신규 (error.rs, validate.rs), 928+/379-

### P3 디자인 감사: 키보드 접근성 + EmptyState + 반응형 ✅
- **키보드 접근성**: `useTabKeyboard` 훅 신규 (ArrowLeft/Right/Home/End + tabIndex 로빙, WAI-ARIA Tabs 패턴)
  - 7개 tablist 적용: AimDnaResult, ScenarioSelect×2, AimDnaGripGuide, ProgressDashboard×2, TrainingPrescription
- **EmptyState 적용**: SessionHistory, ProgressDashboard, TrainingPrescription, AimDnaResult에 아이콘+제목+설명+액션 빈 상태 UI
  - i18n 키 8개 추가 (en.json + ko.json)
- **반응형 레이아웃**: `@media (max-width: 1100px/1000px)` — 그리드 1열 전환, 탭 스크롤, 카드 span 해제
  - tauri.conf.json minWidth 1280→960, minHeight 720→640
- 수정 파일: 10개 수정 + 1개 신규 (useTabKeyboard.ts), 238+/22-

---

### v0.2.0 릴리즈 준비 ✅ (2026-04-05) [claude/sleepy-bardeen → master]
- **CI 보안 감사**: `.github/workflows/security-audit.yml` — cargo audit + npm audit (push/PR/주간 자동 실행)
- **버전 업데이트**: 0.1.0 → 0.2.0 (Cargo.toml, tauri.conf.json, package.json)
- **CHANGELOG.md**: 0.1.0 이후 변경사항 요약 (코드품질, UI디자인, 보안, 기능, CI)

### 줌 캘리브레이션 P2 + P1.5 + P1 (2026-04-05) [claude/jovial-chatterjee]

#### P2: ZoomTier 확장 + 테스트환경 개선
- **ZoomTier 7단계**: `1x/2x/4x/6x/8x/10x/12x` — 각 단계별 거리/타겟크기/속도 그라데이션
- **WeaponSystem 프리셋 추가**: `zoom_6x`(FOV 17°, sens 0.42), `zoom_10x`(FOV 10.3°, sens 0.3), `zoom_12x`(FOV 8.6°, sens 0.25)
- **ZoomMultiFlickScenario**: 4x 고정 → 배율 파라미터로 받도록 수정 (`zoomPreset` 생성자 인자)
- **동적 이동범위 제한**: ±30° 고정 → `min(fov/2 × 0.8, 30)` — ZoomSteady + ZoomMultiFlick 양쪽 적용

#### P1.5: 에이밍 타입별 k 분리
- **Rust k_fitting.rs**: `AimType` enum (Tracking/Flicking/Combined) + `GameZoomProfile` struct + `get_effective_k()` 가중 평균
- **기본 게임 줌 패턴 5종**: CS2 AWP(0/100), Apex 3x(70/30), OW2 아나(90/10), R6 ACOG(40/60), CoD ADS(80/20)
- **fit_k_parameter_with_aim_type()**: aim_type 파라미터 추가 (backward compatible)
- **TS 미러**: `physics.ts`에 `AimType`, `AimTypeKResult`, `GameZoomProfile`, `getEffectiveK()` 추가

#### P1: 크로스게임 줌 감도 변환
- **Rust 커맨드**: `convert_crossgame_zoom_sensitivity` — 소스/타겟 게임, 옵틱, piecewise_k/aim_type_k 지원
- **CrossGameConverter.tsx**: 소스/타겟 게임 선택 + 감도 입력 + 7단계 줌 배율 → 개인 k로 변환 결과 표시
- **ZoomProfileChart.tsx**: 배율 vs k값 SVG 차트 (GPChart 패턴 따름, 측정/보간 포인트 + piecewise 구간 + tracking/flicking k 참조선)

#### 캘리브레이션 모드 네이밍 + 데이터 품질 종료조건
- **ZoomCalibrationMode enum**: Light(3배율/글로벌k) | Standard(5배율/tracking+flicking/piecewise_k) | Deep(7배율/완전 piecewise_k+에이밍타입별)
- **DataQualityStatus**: 전체 정밀도(%), 배율별 "sufficient/needs_more/pending" 상태, GP EI 수렴 + k 분산 임계값 기반
- **ZoomCalibrationStatus 확장**: `calibration_mode` + `data_quality` 필드 추가
- **StartZoomCalibrationParams**: `calibration_mode` 파라미터 추가 ("light"/"standard"/"deep")

수정 파일 11개:
- Rust: `k_fitting.rs`, `zoom_calibration/mod.rs`, `zoom_calibration/commands.rs`, `crossgame/commands.rs`, `lib.rs`
- TS: `types.ts`, `physics.ts`, `ZoomSteadyScenario.ts`, `ZoomMultiFlickScenario.ts`, `WeaponSystem.ts`
- React: `CrossGameConverter.tsx` (신규), `ZoomProfileChart.tsx` (신규)

빌드 검증: Rust 147/147 통과, npm build 성공 (1,447 kB), TS 에러 0

### 줌 캘리브레이션 머지 + 에임 트레이너 DB 추가 ✅ (2026-04-05) [dazzling-moore]

#### Step 1: jovial-chatterjee 워크트리 머지 → master
- 미커밋 변경사항 커밋 후 `claude/jovial-chatterjee` → master no-ff 머지
- 13개 파일 (504+/14-): k_fitting.rs, zoom_calibration/mod.rs, commands.rs, crossgame/commands.rs, lib.rs, CrossGameConverter.tsx, ZoomProfileChart.tsx, WeaponSystem.ts, ZoomSteadyScenario.ts, ZoomMultiFlickScenario.ts, physics.ts, types.ts, status.md

#### Step 2: 에임 트레이너 3개 DB 추가
- **game_db/mod.rs**: Tier1(KovaaK's 2.0, Aim Lab), Tier2(Aiming.Pro) — yaw=0.022, fov=103.0, horizontal
- **gameDatabase.ts**: 동일 3개 + `GameCategory`에 `'trainer'` 타입 추가
- **Onboarding.tsx**: `CATEGORY_COLORS`에 trainer 색상(`#22d3ee`) 추가 (TS 컴파일 에러 수정)
- 빌드 검증: Rust 147/147 통과, npm build 성공 (1,448 kB), TS 에러 0

## 다음 작업

- 사용자 테스트 피드백 반영
- v0.2.0 .msi 빌드 + GitHub 릴리즈
- 줌 캘리브레이션 UI에 정밀도 게이지 + 배율별 상태 표시 프론트엔드 적용

---

## 빌드 상태

| 항목 | 상태 |
|------|------|
| Rust tests | 147/147 통과 |
| npm build | 성공 (1,448 kB) |
| CSS | 104 kB |
| 타입 에러 | 0 |

> 빌드 시점: 2026-04-05 (Cold Forge Phase 1 컬러 교체 후)
