# AimForge 코드 헬스체크 #4: 종합 리포트 + 런치 판정

> **분석일:** 2026-04-02
> **분석 범위:** 미점검 모듈 (calibration, zoom_calibration, trajectory, input, game_db/conversion, lib.rs) + 전체 누적 종합
> **원칙:** 코드 수정 금지. 읽기 전용 분석 & 리포트만.

---

## 1. 세션 4 신규 분석 — 미점검 모듈

### 1.1 Calibration 모듈 (`calibration/`)

**구조:** mod.rs (CalibrationEngine, 2-Stage), screening.rs, fatigue.rs, warmup.rs, go_no_go.rs, commands.rs

| # | 분류 | 파일:라인 | 이슈 | 심각도 |
|---|------|----------|------|--------|
| 1 | P2 | `mod.rs:190-222` | 범위 경계값 (±15, 15-60, ±10%, 0.8/1.2, 0.95/1.05, step 0.5, xi 0.01) 전부 매직 넘버 — 근거 미기재 | LOW |
| 2 | P2 | `mod.rs:373` | `prior_mean / 100.0` — 주석 "대략적" 인정. 스케일링 근거 없음 | LOW |
| 3 | P2 | `mod.rs:458, 479` | `best_observation().unwrap_or((current_cm360, 0.0))` — GP 비정상 시 현재값 유지. 안전하지만 문제 마스킹 가능 | LOW |
| 4 | P2 | `fatigue.rs:59` | `(initial - score) / initial` — initial이 NaN이면 `<= 0.0` 가드 우회. 극히 낮은 확률 | VERY LOW |

**평가:** Calibration 모듈은 전반적으로 안전. 가드 패턴 잘 적용됨. P0/P1 없음.

### 1.2 Zoom Calibration 모듈 (`zoom_calibration/`)

| # | 분류 | 파일:라인 | 이슈 | 심각도 |
|---|------|----------|------|--------|
| 1 | **P0** | `comparator.rs:228` | `method_scores.sort_by(\|a, b\| b.composite_mean.partial_cmp(&a.composite_mean).unwrap())` — composite_mean이 NaN이면 **panic**. n=0일 때 0/0 → NaN → 정렬 크래시 | **CRITICAL** |
| 2 | **P1** | `k_fitting.rs:154` | `sorted.sort_by(\|a, b\| a.zoom_ratio.partial_cmp(&b.zoom_ratio).unwrap())` — zoom_ratio NaN 시 panic | HIGH |
| 3 | **P1** | `k_fitting.rs:72` | `assert!(data.len() >= 2)` — 비-test 코드에서 assert. release에서도 panic | MEDIUM |
| 4 | **P1** | `k_fitting.rs:220` | `pieces.last().unwrap().k` — pieces 빈 배열 시 panic (상위 가드 의존) | MEDIUM |
| 5 | P2 | `mod.rs:366-373, 533` | 매직 넘버 (±30%, step 0.02, k max 3.0) | LOW |

### 1.3 Trajectory 모듈 (`trajectory/`)

| # | 분류 | 파일:라인 | 이슈 | 심각도 |
|---|------|----------|------|--------|
| 1 | **P1** | `mod.rs:117` | `360.0 / cm360` — cm360=0 시 Inf. 입력 검증 없음 | HIGH |
| 2 | P2 | `mod.rs:228` | `sorted.sort_by(\|a, b\| a.partial_cmp(b).unwrap_or(Ordering::Equal))` — NaN-safe. 좋음 ✅ |  |
| 3 | P2 | `mod.rs:115, 182-188, 222, 362-411, 439` | 매직 넘버 다수 (200ms lookback, 2/5cm 운동체계 경계, EM max_iter 30, 감도 진단 임계값 등) | LOW |

**GMM EM 알고리즘:** 0 나눗셈 가드 잘 구현됨 (`n_a < 1.0 || n_b < 1.0` → break, `avg_var > 0.0`, `.max(1e-10)`)

### 1.4 Input 모듈 (`input/`)

| # | 분류 | 파일:라인 | 이슈 | 심각도 |
|---|------|----------|------|--------|
| 1 | **P1** | `raw_input.rs:193, 212-215, 290` | Sender 포인터 레이스 컨디션: `SetWindowLongPtrW`로 Box::into_raw 저장 → callback에서 동시 읽기 → cleanup에서 `Box::from_raw` — RAII 미보장 | HIGH |
| 2 | **P1** | `raw_input.rs:180-187` | `RegisterRawInputDevices` 호출 후 `UnregisterRawInputDevices` 미호출 — 디바이스 상태 누수 | HIGH |
| 3 | **P1** | `commands.rs:84` | `handle.join()` 타임아웃 없음 — raw input 스레드 행 시 Tauri 이벤트 루프 블로킹 | HIGH |
| 4 | **P1** | `commands.rs:113-114` | `total_dx/dy` i32 누적 — 1000Hz 마우스에서 오버플로우 가능 | MEDIUM |
| 5 | P2 | `raw_input.rs:146` | `RegisterClassExW` 반환값 미검사 | LOW |

### 1.5 Game DB Conversion (`game_db/conversion.rs`)

| # | 분류 | 파일:라인 | 이슈 | 심각도 |
|---|------|----------|------|--------|
| 1 | **P1** | `conversion.rs:72` | `scope_rad.tan() == 0.0` — f64 정확한 0 비교. 부동소수점 오차로 실패 가능 → 나눗셈 Inf | HIGH |
| 2 | **P1** | `conversion.rs:20,30,42,99,109` | 기타 `== 0.0` 비교 5곳 — epsilon 비교 사용 권장 | MEDIUM |
| 3 | P2 | `conversion.rs:102,112,134,139,143` | 작은 값 나눗셈 — 비물리적 배율 생성 가능 | LOW |

### 1.6 lib.rs (앱 진입점)

| # | 분류 | 파일:라인 | 이슈 | 심각도 |
|---|------|----------|------|--------|
| 1 | **P0** | `lib.rs:58, 62, 63` | `.expect()` 3곳 — 앱 초기화 실패 시 graceful 에러 없이 panic. (세션 1에서 이미 보고) | CRITICAL |
| 2 | P2 | `lib.rs:59` | `create_dir_all().ok()` — 디렉토리 생성 실패 무시 | MEDIUM |

---

## 2. 전체 누적 P0/P1/P2 요약

### 2.1 P0 — 크래시/데이터 손상 (총 15건)

| # | 세션 | 모듈 | 파일:라인 | 이슈 | 수정 공수 |
|---|------|------|----------|------|----------|
| 1 | S1 | lib.rs | `:58` | `.expect()` — app_data_dir 실패 시 panic | 5분 |
| 2 | S1 | lib.rs | `:62` | `.expect()` — Database::new 실패 시 panic | 5분 |
| 3 | S1 | lib.rs | `:63` | `.expect()` — initialize_schema 실패 시 panic | 5분 |
| 4 | S1 | gp/model.rs | `:92-93` | `.expect()` — alpha/Cholesky None 시 panic | 15분 |
| 5 | S1 | gp/model.rs | `:183` | `assert!` — release에서 비활성 → NaN 무음 전파 | 20분 |
| 6 | S2 | App.tsx | 전체 | 1,183줄 메가 컴포넌트 (구조적 위기) | 2-3시간 |
| 7 | S2 | ScenarioSelect.tsx | `:152` | invoke 에러 핸들링 0% | 10분 |
| 8 | S2 | stores/ | 18파일 | invoke 실패 시 UI 무반응 (console.error만) | 1-2시간 |
| 9 | S3 | gp/analysis.rs | `:167` | `partial_cmp().unwrap()` — NaN 시 panic | 5분 |
| 10 | S3 | 6개 시나리오 | setTimeout | setTimeout 미추적 → dispose 후 콜백 잔존 | 30분 |
| 11 | S3 | GameEngine.ts | `:107` | canvas click 리스너 미제거 → 엔진 재생성 시 누적 | 10분 |
| 12 | S3 | GameEngine.ts | `:276-283` | WebGL context 리스너 미제거 | 10분 |
| 13 | S4 | zoom_cal/comparator.rs | `:228` | `partial_cmp().unwrap()` — NaN 시 panic | 5분 |
| 14-15 | S1 | gp/model.rs | `:92-93` | (S1 #4와 동일 — expect 2개를 별도 카운트 시) | — |

**실질 P0: 13건** (중복 제외)

### 2.2 P1 — 런칭 전 수정 권장 (총 50+건)

| 카테고리 | 건수 | 주요 항목 |
|---------|------|----------|
| NaN partial_cmp unwrap | 3 | k_fitting.rs:154, fov_profile, zoom_cal/mod.rs |
| 부동소수점 == 0.0 비교 | 6 | conversion.rs 전체 |
| Empty/Null 가드 누락 | 5 | k_fitting:220, AimDnaScanScenario:113 등 |
| Unsafe/RAII | 3 | raw_input.rs 포인터 레이스, RegisterRawInputDevices |
| 블로킹 I/O | 2 | join() 타임아웃 없음, movement fs 동기 |
| GP 수치 불안정 | 4 | kernel length_scale=0, combined_var sqrt, assert release 등 |
| React 에러 핸들링 | 4+ | invoke catch 누락, useEffect 무한루프 |
| D3 React.memo | 2 | RadarChart, PerformanceLandscape |
| Type safety | 4 | invoke\<any\>, as any, as unknown as |
| 기타 | 17+ | 위 카테고리에 해당하지 않는 개별 건 |

### 2.3 P2 — 개선 권장 (총 40+건)

매직 넘버, clone() 과다, 문서화 부족, 구조적 개선 등

---

## 3. 런치 Go/No-Go 판정

### 3.1 판정 기준

| 기준 | 상태 | 판정 |
|------|------|------|
| 빌드 성공 | Rust 147/147, npm build 1,082kB, TS 에러 0 | ✅ PASS |
| P0 크래시 경로 | 13건 존재 (NaN→panic, expect, setTimeout, 리스너 누적) | ⚠️ CONDITIONAL |
| P1 데이터 무결성 | 부동소수점 비교, 수치 불안정 경로 존재 | ⚠️ CONDITIONAL |
| 보안 | WinAPI unsafe — 내부 사용, 외부 입력 제한적 | ✅ ACCEPTABLE |
| 메모리 누수 | setTimeout + 이벤트 리스너 — 장시간 사용 시 누적 | ⚠️ CONDITIONAL |

### 3.2 판정: **조건부 GO** ✅⚠️

**필수 수정 후 런칭 가능.** 아래 항목 수정 시 런칭 승인.

### 3.3 런칭 전 필수 수정 (P0 Fix Sprint)

**예상 총 공수: ~4-5시간**

#### Block A: GP NaN 크래시 체인 (1시간)
1. `gp/model.rs:183` — assert → Result 에러 반환
2. `gp/model.rs:92-93` — expect → Option 기반 에러 전파
3. `gp/analysis.rs:167` — `unwrap()` → `unwrap_or(Ordering::Equal)`
4. `zoom_calibration/comparator.rs:228` — 동일 패턴 수정

#### Block B: lib.rs 초기화 (15분)
5. `lib.rs:58,62,63` — expect → Result 에러 + 사용자 알림 대화상자

#### Block C: Three.js 리소스 관리 (1시간)
6. 6개 시나리오 setTimeout → timerIds 배열 + dispose() clearTimeout
7. `GameEngine.ts:107` — click 리스너 → named 핸들러 + dispose 제거
8. `GameEngine.ts:276-283` — context 리스너 → named 핸들러 + dispose 제거

#### Block D: 프론트엔드 안정성 (1-2시간)
9. `ScenarioSelect.tsx:152` — invoke 에러 → safeInvoke + Toast 알림
10. stores/ 핵심 3개 (sessionStore, engineStore, settingsStore) — invoke 실패 → Toast

#### Block E: 부동소수점 안전 (30분)
11. `conversion.rs` — `== 0.0` → epsilon 비교 (`.abs() < 1e-10`)

#### 런칭 후 개선 (P1 Sprint)
- App.tsx 분할 (2-3시간) — 기능별 컴포넌트 추출
- stores/ 전체 safeInvoke 전환 (1시간)
- raw_input.rs RAII 개선 (1시간)
- 매직 넘버 상수화 + 문서화 (별도 스프린트)

---

## 4. 세션별 요약 참조

| 세션 | 범위 | 보고서 | P0 | P1 | P2 |
|------|------|--------|-----|-----|-----|
| #1 | 프로젝트 구조 + Rust 백엔드 | `AIMFORGE_HEALTH_01_STRUCTURE_RUST.md` | 5 | 14 | 20+ |
| #2 | React 프론트엔드 + 상태 관리 | `AIMFORGE_HEALTH_02_FRONTEND.md` | 3 | 18 | 8 |
| #3 | GP 엔진 + Three.js | `AIMFORGE_HEALTH_03_GP_THREEJS.md` | 6 | 9 | 9 |
| #4 | 미점검 모듈 + 종합 | `AIMFORGE_HEALTH_FINAL.md` (본 문서) | 1 | 10 | 8 |
| **누적** | | | **15** | **51** | **45+** |

---

## 5. 전체 코드베이스 강점 ✅

- **순환 의존 없음** — 모듈 간 깔끔한 단방향 의존
- **순수 Rust 수학 엔진** — GP, GMM, erf 모두 외부 의존 없이 구현
- **Cholesky 기반 GP** — 수치적으로 올바른 구현 (jitter, variance clamp)
- **더블 버퍼 입력** — IPC 비동기 프리페치로 렌더 블로킹 최소화
- **Quaternion 카메라** — gimbal lock 방지
- **dispose 패턴** — Three.js geometry/material 명시적 해제
- **GMM 가드** — 0 나눗셈 체계적 방어 (n_a < 1.0 → break)
- **trajectory NaN-safe 정렬** — `unwrap_or(Ordering::Equal)` 사용 (모범 사례)
- **빌드 안정성** — Rust 147/147, TS 에러 0, npm build 1,082kB

---

> **결론:** 27,680줄 코드베이스에서 실질 P0 13건, P1 51건. P0의 핵심은 **(1) GP NaN 크래시 체인**, **(2) lib.rs 초기화 panic**, **(3) Three.js 리소스 미정리**. 이 3개 블록(~2.5시간)을 수정하면 런칭 가능한 수준. 부동소수점 비교와 stores safeInvoke는 추가 30분-1시간으로 안정성을 크게 높일 수 있으므로 포함을 강력히 권장.
