# AimForge 코드 헬스체크 #1: 프로젝트 구조 + Rust 백엔드

> **분석일:** 2026-04-01
> **분석 범위:** 프로젝트 구조 전체 + Rust 백엔드 (src-tauri/src/)
> **원칙:** 코드 수정 금지. 읽기 전용 분석 & 리포트만.

---

## 1. 프로젝트 구조 요약

### 1.1 디렉토리 구조

```
aimforge/
├── src-tauri/src/           # Rust 백엔드 (43파일, 14,142줄)
│   ├── lib.rs               # Tauri 앱 진입점, AppState, 커맨드 등록
│   ├── db/                  # SQLite DB 관리 (mod.rs 2,252줄 + commands.rs 363줄)
│   ├── gp/                  # Gaussian Process (model/kernel/acquisition/analysis/normal)
│   ├── calibration/         # 2-Stage 감도 최적화 (mod/commands/screening/go_no_go/fatigue/warmup)
│   ├── zoom_calibration/    # 줌 캘리브레이션 (mod/commands/comparator/k_fitting)
│   ├── aim_dna/             # Aim DNA 26피처 산출 (mod.rs 952줄)
│   ├── training/            # 훈련 처방 (mod/commands/readiness/style_transition)
│   ├── crossgame/           # 크로스 게임 비교 (mod/commands)
│   ├── trajectory/          # 궤적 분석 GMM (mod.rs 580줄)
│   ├── game_db/             # 10개 게임 프리셋 + 감도 변환 (mod/conversion/commands/recoil_commands)
│   ├── movement/            # 무브먼트 프로파일 (mod/commands)
│   ├── hardware/            # 하드웨어 비교 (mod/commands)
│   ├── fov_profile/         # FOV 프로파일 (mod/commands)
│   └── input/               # WinAPI Raw Input (mod/commands/raw_input)
├── src/                     # React 프론트엔드 (120+파일, 13,538줄)
│   ├── components/          # 48개 React 컴포넌트
│   ├── stores/              # 18개 Zustand 스토어
│   ├── engine/              # Three.js 게임 엔진 + 28개 시나리오
│   ├── utils/               # 유틸리티 (types.ts 1,125줄)
│   └── i18n/                # 한국어/영어 번역
└── docs/                    # 문서
```

**전체 코드베이스: ~27,680줄**

### 1.2 Rust 모듈 의존성 맵

```
gp ← (독립, 순수 수학)
  ↑
calibration ← gp, game_db, db
  ↑
zoom_calibration ← gp, game_db, calibration/fatigue
aim_dna ← db, game_db
training ← aim_dna, db
crossgame ← aim_dna, db
trajectory ← (독립)
movement ← game_db
hardware ← db
input ← WinAPI (독립)
```

**순환 의존성: 없음** ✅

### 1.3 Tauri 커맨드: 총 ~100개 등록 (lib.rs)

### 1.4 Rust 파일 규모 상위 10

| 파일 | 줄 수 | 역할 |
|------|-------|------|
| db/mod.rs | 2,252 | SQLite CRUD 전체 |
| aim_dna/mod.rs | 952 | DNA 26피처 산출 |
| zoom_calibration/mod.rs | 860 | 줌 캘리브레이션 엔진 |
| calibration/mod.rs | 653 | 감도 최적화 엔진 |
| trajectory/mod.rs | 580 | GMM 궤적 분석 |
| training/mod.rs | 541 | 훈련 처방 |
| crossgame/mod.rs | 512 | 크로스 게임 비교 |
| zoom_calibration/comparator.rs | 477 | 변환 방식 비교기 |
| movement/mod.rs | 425 | 무브먼트 프리셋 |
| calibration/go_no_go.rs | 407 | Go/No-Go 메커니즘 |

---

## 2. Rust 백엔드 이슈 리스트

### 2.1 P0 — 런치 블로커 (5건)

| # | 파일:라인 | 코드 | 이유 |
|---|----------|------|------|
| 1 | `lib.rs:58` | `.expect("failed to get app data dir")` | 앱 데이터 디렉토리 취득 실패 시 앱 크래시. 사용자 환경 문제(권한 부족, 경로 오류)에서 발생 가능 |
| 2 | `lib.rs:62` | `.expect("failed to initialize database")` | DB 초기화 실패 시 앱 전체 실행 불가. DB 손상/디스크 부족/잠금 등 |
| 3 | `lib.rs:63` | `.expect("failed to create schema")` | 스키마 생성 실패 시 앱 시작 불가 |
| 4 | `gp/model.rs:92-93` | `.expect("alpha가 계산되지 않음")` / `.expect("Cholesky가 계산되지 않음")` | predict() 호출 시 내부 상태 불일치면 panic. add_observation 후 recompute_cholesky() 경로에서 발생 가능 |
| 5 | `gp/model.rs:183` | `assert!(diag > 0.0, "Cholesky 실패...")` | 수치 오차/데이터 오염으로 양정치 행렬 조건 불만족 시 panic. jitter(1e-6) 고정값이라 극단적 데이터에서 부족할 수 있음 |

> **참고:** `lib.rs:181`의 `.expect("error while running tauri application")`은 Tauri 공식 패턴으로, 이벤트 루프 실패 자체가 회복 불가능하므로 P0에서 제외.

### 2.2 P1 — 런치 전 수정 권장 (14건)

| # | 파일:라인 | 코드 | 이유 |
|---|----------|------|------|
| 6 | `fov_profile/mod.rs:85` | `.sort_by(\|a,b\| a.partial_cmp(b).unwrap())` | NaN 값 정렬 시 panic. FOV 데이터에 NaN 유입 가능 |
| 7 | `gp/analysis.rs:167` | `.sort_by(\|a,b\| a.partial_cmp(b).unwrap())` | peak score NaN 시 정렬 panic |
| 8 | `zoom_calibration/mod.rs:609` | `.sort_by(\|a,b\| a.partial_cmp(b).unwrap())` | zoom_ratio NaN 정렬 시 panic |
| 9 | `zoom_calibration/comparator.rs:228` | `.sort_by(\|a,b\| a.partial_cmp(b).unwrap())` | composite_mean NaN 정렬 시 panic |
| 10 | `zoom_calibration/k_fitting.rs:220` | `pieces.last().unwrap().k` | pieces 벡터가 비어있으면 panic. 입력 데이터 3개 미만 시 발생 |
| 11 | `zoom_calibration/comparator.rs:237-239` | `method_scores[0]` | 정렬 후 직접 [0] 접근. method_scores 비었을 때 panic |
| 12 | `zoom_calibration/mod.rs:317-380` | `self.phase_scores[idx]`, `self.per_ratio_gp[idx]`, `self.selected_profiles[idx]` | `current_ratio_idx` 기반 직접 인덱싱. idx 범위 검증 부재 |
| 13 | `zoom_calibration/k_fitting.rs:217-218` | `pieces[0].ratio_start` | pieces 빈 벡터 시 panic |
| 14 | `movement/commands.rs:172,181` | `std::fs::create_dir_all()`, `std::fs::write()` | async 커맨드 핸들러 내 동기 파일 I/O. UI 스레드 블로킹 |
| 15 | `input/raw_input.rs:192-215` | `Box::into_raw(sender_box)` | Box raw pointer 사용 후 에러 경로에서 정리 누락 가능. 메모리 누수 위험 |
| 16 | `trajectory/mod.rs:253` | `total.ln()` | total > 1e-300 체크는 있으나 is_finite() 미확인 |
| 17 | `game_db/conversion.rs:72` | `if scope_rad.tan() == 0.0` | 부동소수점 == 비교. `abs() < 1e-10` 권장 |
| 18 | `input/raw_input.rs:135-146` | `RegisterClassExW` → `CreateWindowExW` | RegisterClassExW 반환값 검증 없음. 클래스 등록 실패 후 윈도우 생성 시도 |
| 19 | `input/raw_input.rs:75` | `.unwrap_or(0)` | UTF-16 파싱 실패 시 0 사용. 마우스 가속 감지 오류 가능 |

### 2.3 P2 — 런치 후 가능 / 기술 부채 (주요 항목)

| # | 카테고리 | 설명 | 예시 위치 |
|---|---------|------|----------|
| 20 | clone() 과다 | 40+ 사용처. 대부분 소규모 String clone이나 불필요한 경우 포함 | movement/mod.rs:198-215 (6회), zoom_calibration 9회 |
| 21 | .ok() 에러 무시 | 에러를 묵묵히 무시하는 .ok() 호출 | lib.rs:59, training/commands.rs:154,336 |
| 22 | unwrap_or_default() | 에러 시 기본값 사용, 데이터 오염 가능 | input/raw_input.rs:35,138 |
| 23 | String 에러 타입 | 모든 Tauri 커맨드가 `Result<T, String>` 사용. 프론트엔드에서 에러 구분 불가 | db/commands.rs, calibration/commands.rs 등 전체 |
| 24 | unsafe 블록 | WinAPI 호출 4곳 (정상 패턴이나 RAII 래퍼 부재) | input/raw_input.rs:18-26,49-84,135-146,192-215 |
| 25 | filter_map 에러 스킵 | DB 행 파싱 에러 무시, 데이터 손실 가능 | db/mod.rs:491 |
| 26 | 테스트 unwrap | 테스트 코드에서 .unwrap() 사용 (~15곳) | aim_dna/mod.rs, hardware/mod.rs, trajectory/mod.rs 등 |

---

## 3. 수치 안정성 요약 (GP 엔진)

| 항목 | 상태 | 비고 |
|------|------|------|
| 0 나누기 방지 | ✅ 우수 | 대부분 `if x == 0.0` 체크 있음 |
| NaN/Infinity 처리 | ✅ 우수 | `.max(1e-10)` 패턴 적용 |
| 행렬 특이성 | ⚠️ 개선 필요 | assert panic → Result 반환 필요 (P0 #5) |
| 부동소수점 비교 | ⚠️ 1건 | conversion.rs:72 tan() == 0.0 |
| 로그/지수 domain | ✅ 양호 | 대부분 체크 있음, trajectory 1건 미비 |
| jitter 값 | ⚠️ 고정값 | 1e-6 고정. 적응형 jitter 고려 필요 |

---

## 4. 미점검 영역 (세션 2~3에서 진행)

- [ ] React 컴포넌트 구조 & 코드 품질 (48개 컴포넌트)
- [ ] Zustand 상태 관리 패턴 (18개 스토어)
- [ ] useEffect 위험, 렌더링 성능
- [ ] Tauri invoke 통신 패턴
- [ ] Three.js 게임 엔진 (WebGL 메모리, dispose, FOV 계산)
- [ ] 시나리오 시스템 (28개 시나리오, 랜덤 시드, 전환 정리)
- [ ] 마우스 입력 정확도/지연 상세
- [ ] GP 알고리즘 정합성 상세 (경계 조건, 극단값)

---

## 5. P0 수정 방향 요약

| # | 이슈 | 수정 방향 | 난이도 |
|---|------|----------|--------|
| 1-3 | lib.rs expect() 3개 | `match`로 에러 처리 + 로그 + 유저 알림 다이얼로그 | S |
| 4 | gp/model.rs expect() | predict() 호출 전 alpha/cholesky 존재 검증, 또는 Result 반환 | S |
| 5 | gp/model.rs assert() | `cholesky_decompose()` → `Result<Vec<Vec<f64>>, String>` 반환 + 적응형 jitter | M |
