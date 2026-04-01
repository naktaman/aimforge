# AimForge 코드 헬스체크 #3: GP 엔진 수치 안정성 + Three.js 게임 엔진

> **분석일:** 2026-04-01
> **분석 범위:** GP Bayesian Optimization (src-tauri/src/gp/ 6파일) + Three.js 게임 엔진 (src/engine/ 47파일)
> **원칙:** 코드 수정 금지. 읽기 전용 분석 & 리포트만.

---

## 1. GP 엔진 구조 요약

### 1.1 파일 구성

```
src-tauri/src/gp/
├── mod.rs           # 모듈 re-export (24줄)
├── normal.rs        # erf, CDF, PDF — Abramowitz & Stegun 7.1.26 (105줄)
├── kernel.rs        # Matérn 5/2 커널 (130줄)
├── model.rs         # GP 사후 분포, Cholesky 분해 (355줄)
├── acquisition.rs   # Expected Improvement + grid search (147줄)
└── analysis.rs      # 수렴 판정, 이봉 감지, 유의성 검정 (354줄)
```

**총 ~1,115줄** — 외부 의존 없이 순수 Rust 구현

### 1.2 데이터 흐름

```
사용자 트라이얼 (cm/360, score)
  → GaussianProcess.add_observation()
    → recompute_cholesky() [K + σ²I + jitter = LLᵀ]
    → forward_solve + backward_solve → α = L⁻ᵀL⁻¹(y - μ₀)
  → predict(x_new) → Prediction { mean, variance }
  → expected_improvement() → EI 값
  → next_candidate() → 다음 테스트 cm/360
  → check_convergence() → 종료 판정
  → detect_bimodal() → 이봉 감지
  → significance_test() → 변경 유의성
```

---

## 2. GP 엔진 이슈

### 2.1 P0 — 크래시 위험 (3건)

| # | 파일:라인 | 코드 | 위험 | 수정 방향 |
|---|----------|------|------|----------|
| 1 | `gp/analysis.rs:167` | `peaks.sort_by(\|a, b\| b.score.partial_cmp(&a.score).unwrap())` | GP 예측이 NaN 반환 시 (수치 불안정) `partial_cmp`가 `None` → `unwrap()` **panic** | `.unwrap_or(std::cmp::Ordering::Equal)` |
| 2 | `gp/model.rs:183` | `assert!(diag > 0.0, "Cholesky 실패: 행렬이 양정치가 아님")` | `assert!`는 **release 빌드에서 비활성화**됨. 양정치 위반 시 `diag.sqrt()`가 NaN → 이후 모든 예측 오염. 사용자에게 잘못된 감도 추천 | `if diag <= 0.0 { return Err(GpError::CholeskyFailed) }` — Result 반환 |
| 3 | `gp/model.rs:92-93` | `.expect("alpha가 계산되지 않음")` / `.expect("Cholesky가 계산되지 않음")` | `n > 0`인데 `recompute_cholesky()`가 panic으로 중단된 경우 `alpha=None` 상태에서 `predict()` 호출 → **panic** | `Option::ok_or()` + `Result` 반환으로 변경 |

**P0 발생 시나리오:**
- 관측 데이터가 매우 가까운 x값을 가지면 커널 행렬이 near-singular → Cholesky diag ≤ 0
- release 빌드에서 assert 비활성 → NaN이 alpha에 전파 → predict()의 mean/variance가 NaN
- detect_bimodal()에서 NaN score 정렬 시 panic으로 앱 크래시

### 2.2 P1 — 수치 오류 위험 (5건)

| # | 파일:라인 | 코드 | 위험 |
|---|----------|------|------|
| 1 | `gp/kernel.rs:18-22` | `Matern52Kernel::new(length_scale, signal_var)` | `length_scale=0` 또는 음수 검증 없음. `compute()` 에서 `ratio = sqrt5 * r / 0.0` → **Inf** 전파 |
| 2 | `gp/analysis.rs:210` | `let combined_std = combined_var.sqrt()` | `combined_var = pred_optimal.variance + pred_current.variance`가 수치 오차로 음수일 수 있음 → **NaN** |
| 3 | `gp/analysis.rs:213-218` | `if combined_std < 1e-10 { ... 3.0 ... }` | 두 예측의 분산이 모두 0에 가까울 때 z_score=3.0 하드코딩. `pred_optimal.mean == pred_current.mean`인 경우에도 3.0 반환 → 잘못된 "Recommend" 판정 가능 |
| 4 | `gp/model.rs:186` | `l[i][j] = (a[i][j] - sum) / l[j][j]` | release에서 assert 비활성 시 `l[j][j]`가 0 또는 NaN일 수 있음 → Inf/NaN 전파 |
| 5 | `gp/model.rs:74` | `assert_eq!(xs.len(), ys.len(), "입력/출력 길이 불일치")` | release 빌드에서 `assert_eq!` 비활성화 → 길이 불일치 시 잘못된 Cholesky 계산 (silent 오류) |

### 2.3 P2 — 개선 권장 (5건)

| # | 위치 | 이슈 |
|---|------|------|
| 1 | `model.rs:45`, `model.rs:106`, `acquisition.rs:14`, `analysis.rs:213` | 동일한 `1e-10` 임계값이 4곳에서 서로 다른 용도로 사용 (jitter는 `1e-6`). 명시적 상수 정의 필요 |
| 2 | `analysis.rs:17-32` | 수렴 임계값 (Quick 0.01/15회, Deep 0.005/25회, Obsessive 0.001/40회) — 근거/출처 미기재 |
| 3 | `kernel.rs:26-30` | `default_for_calibration()` 하이퍼파라미터 (`length_scale=5.0`, `signal_var=0.1`) — 근거 미기재 |
| 4 | `model.rs:52` | `GaussianProcess::default_for_calibration()` — `noise_var=0.015` 선택 근거 미기재 |
| 5 | `normal.rs:36-37` | CDF 공식: `0.5 * (1.0 + erf(z / SQRT_2))` — 맞음. 하지만 erf 근사 최대 오차 ~2.5×10⁻⁵ 명시 (이미 주석에 있으나 p-value 정밀도에 영향 가능) |

### 2.4 GP 엔진 강점 ✅

- 관측 0건 시 사전 분포 반환 (`predict()` line 84) — 안전
- 분산 음수 방지: `.max(1e-10)` (`model.rs:106`) — 좋음
- EI sigma 0 가드: `if sigma < 1e-10 { return 0.0 }` (`acquisition.rs:14`) — 좋음
- best_observation()이 Option 반환 (`model.rs:124`) — 안전
- next_candidate()가 관측 없을 때 중앙값 반환 (`acquisition.rs:36-39`) — 합리적
- erf 근사 계수 출처 명시 (Abramowitz & Stegun 7.1.26) — 좋음
- 테스트 커버리지: 22개 테스트 (model 7, kernel 5, acquisition 5, analysis 4, normal 5)

---

## 3. Three.js 게임 엔진 구조 요약

### 3.1 파일 구성

```
src/engine/
├── GameEngine.ts            # 핵심 엔진 (402줄) — renderer/scene/camera/rAF 루프
├── Environment.ts           # 3D 환경 생성
├── Target.ts                # 타겟 오브젝트
├── TargetManager.ts         # 타겟 CRUD + 히트 판정
├── HitDetection.ts          # Raycaster 히트 판정
├── InputRecorder.ts         # 입력 녹화
├── PlayerController.ts      # 플레이어 이동
├── PointerLock.ts           # Pointer Lock API 래퍼
├── WeaponSystem.ts          # 무기 시스템
├── AudioManager.ts          # 효과음
├── metrics/                 # 메트릭 수집 (5파일)
│   ├── MetricsCollector.ts  # 플릭/트래킹 메트릭 집계
│   ├── CompositeScore.ts    # 복합 점수 산출
│   ├── VelocityTracker.ts   # 속도/가속도 추적
│   ├── MotorClassifier.ts   # 운동체계 분류
│   └── ClickClassifier.ts   # 클릭 타입 분류
└── scenarios/               # 시나리오 (32파일)
    ├── Scenario.ts          # 추상 기본 클래스
    ├── ScenarioBattery.ts   # 배터리 순차 실행
    ├── FlickScenario.ts     # 플릭 공통 로직
    ├── stages/              # 구체 시나리오 20+개
    └── Zoom*.ts             # 줌 시나리오 4개
```

**총 ~47파일, 약 8,000줄**

### 3.2 엔진 라이프사이클

```
Viewport.tsx
  → new GameEngine(canvas, config)
    → WebGLRenderer + Scene + PerspectiveCamera
    → setupContextHandlers()
    → window.addEventListener('resize')
    → canvas.addEventListener('click')
  → engine.start()
    → invoke('start_mouse_capture')
    → onPointerLockChange()
    → rAF loop 시작
      → prefetchMouseBatch() [더블 버퍼]
      → applyMouseDelta() [raw → cm → deg → Quaternion]
      → scenario.update(dt)
      → targetManager.update(dt)
      → renderer.render()
  → engine.dispose()
    → stop() [rAF 취소, 캡처 중지, pointerLock cleanup]
    → scene.traverse() [geometry/material dispose]
    → renderer.dispose()
```

---

## 4. Three.js 엔진 이슈

### 4.1 P0 — 메모리 누수 / 크래시 위험 (3건)

| # | 파일:라인 | 코드 | 위험 | 수정 방향 |
|---|----------|------|------|----------|
| 1 | 6개 시나리오 | `setTimeout(() => this.spawnWave(), ...)` | **setTimeout 반환값 미저장**, `dispose()` 시 clearTimeout 불가. 시나리오 전환 후 콜백이 이미 해제된 타겟매니저에 접근 → 에러 또는 고스트 타겟 생성 | 타이머 ID 배열 저장 + dispose()에서 clearTimeout |

**해당 파일 목록:**
- `stages/FlickMacroScenario.ts:159` — `setTimeout(() => this.spawnNext(), 500 + Math.random() * 400)`
- `stages/FlickMediumScenario.ts:154` — `setTimeout(() => this.spawnNext(), 400 + Math.random() * 300)`
- `stages/FlickMicroScenario.ts:150` — `setTimeout(() => this.spawnNext(), 300 + Math.random() * 200)`
- `stages/MultiFlickScenario.ts:207` — `setTimeout(() => this.spawnWave(), 1000)`
- `stages/SwitchingCloseScenario.ts:220` — `setTimeout(() => this.spawnWave(), 500 + Math.random() * 300)`
- `stages/SwitchingWideScenario.ts:223` — `setTimeout(() => this.spawnWave(), 600 + Math.random() * 400)`

| # | 파일:라인 | 코드 | 위험 | 수정 방향 |
|---|----------|------|------|----------|
| 2 | `GameEngine.ts:107-111` | `canvas.addEventListener('click', () => {...})` | 익명 함수로 등록 → `dispose()`에서 `removeEventListener` 불가. 엔진 재생성 시 리스너 누적 | 핸들러를 named 메서드로 저장 + dispose()에서 제거 |
| 3 | `GameEngine.ts:276-283` | `canvas.addEventListener('webglcontextlost/restored', ...)` | 동일하게 익명 함수 → dispose()에서 제거 불가. 엔진 재생성 시 누적 | named 핸들러 + dispose()에서 제거 |

### 4.2 P1 — 엣지 케이스 / 잠재적 문제 (4건)

| # | 파일:라인 | 코드 | 위험 |
|---|----------|------|------|
| 1 | `stages/AimDnaScanScenario.ts:113` | `this.targetManager.updateTargetPosition(this.trackingTargetId, pos)` | `trackingTargetId`가 null/undefined일 수 있으나 null 체크 없음 — targetManager 구현에 따라 무시 또는 에러 |
| 2 | `Scenario.ts:33-35` | `dispose() { this.targetManager.clear(); }` | base class dispose()가 타이머 정리를 하지 않음. 서브클래스에서 override 시 `super.dispose()` 호출만으로는 setTimeout 미정리 |
| 3 | `GameEngine.ts:127-128` | `console.warn('마우스 캡처 시작 실패'); this.capturing = true;` | 캡처 실패 시에도 `capturing = true` 설정 — 의도적이지만 코멘트의 "(이미 실행 중?)"가 유일한 판단 근거. 다른 실패 원인 시 false positive |
| 4 | `GameEngine.ts:131-133` | `onPointerLockChange((locked) => {...})` | `stop()` 호출 없이 페이지 전환 시 `cleanupPointerLock`이 null인 채 리스너 잔존. Viewport.tsx가 `dispose()` → `stop()` 경로로 정리하지만, start() 후 dispose() 전에 컴포넌트 언마운트되는 타이밍 이슈 가능 |

### 4.3 P2 — 개선 권장 (4건)

| # | 위치 | 이슈 |
|---|------|------|
| 1 | `FlickScenario.ts:49` | `minAngularError = Infinity` 초기값 사용 — 정상 패턴이나 `Infinity` 비교가 5곳에 분산. 상수 또는 유틸 함수로 통일 권장 |
| 2 | `MetricsCollector.ts:311-316` | 빈 배열 시 모든 메트릭 0 반환 — 정상이지만 디버깅 시 "메트릭 0" vs "데이터 없음" 구분 불가 |
| 3 | `CompositeScore.ts:153` | `reacquireBonus = Math.max(0, 100 - avgReacquireTimeMs / 10)` — avgReacquireTimeMs=0 시 보너스 100 (×0.1 가중치). 의도 확인 필요 |
| 4 | `GameEngine.ts:70-111` | constructor에서 4개 이벤트 리스너 등록 (resize, click, contextlost, contextrestored) — dispose()에서 resize만 제거. 나머지 3개 누락 |

### 4.4 Three.js 엔진 강점 ✅

- **dispose() 패턴 구현**: `scene.traverse()`로 geometry/material 명시적 해제 (`GameEngine.ts:244-257`) — 좋음
- **더블 버퍼 입력**: IPC 비동기 프리페치로 렌더 블로킹 최소화 (`GameEngine.ts:357-369`) — 좋은 설계
- **rAF 정상 정리**: `cancelAnimationFrame` + `isRunning` 가드 (`GameEngine.ts:144-147, 291`) — 좋음
- **Quaternion 사용**: gimbal lock 방지 (`GameEngine.ts:389-391`) — 정확
- **pitch clamp**: ±89° 제한 (`GameEngine.ts:385-386`) — FPS 표준
- **VelocityTracker**: dt ≤ 0 가드 (`VelocityTracker.ts:47, 62`) — 좋음
- **CompositeScore**: `totalWeight > 0` 가드 (`CompositeScore.ts:190`) — 좋음
- **Viewport cleanup**: useEffect return에서 `engine.dispose()` 호출 (`Viewport.tsx:50-54`) — 올바른 React 패턴

---

## 5. 종합 통계

### 5.1 이슈 요약

| 카테고리 | P0 | P1 | P2 |
|---------|-----|-----|-----|
| GP 엔진 (수치 안정성) | 3 | 5 | 5 |
| Three.js 엔진 (리소스 관리) | 3 | 4 | 4 |
| **합계** | **6** | **9** | **9** |

### 5.2 세션 1~3 누적

| 세션 | P0 | P1 | P2 |
|------|-----|-----|-----|
| #1 Rust 백엔드 | 5 | 14 | 20+ |
| #2 React 프론트엔드 | 3 | 18 | 8 |
| #3 GP + Three.js | 6 | 9 | 9 |
| **누적** | **14** | **41** | **37+** |

### 5.3 P0 긴급 수정 우선순위

1. **GP NaN 크래시 체인** (P0 #1~3 연결)
   - `model.rs:183` assert → Result 변경 (근본 원인)
   - `model.rs:92-93` expect → Result 변경 (전파 방지)
   - `analysis.rs:167` unwrap → NaN-safe 정렬 (크래시 방지)
   - 예상 공수: ~1시간

2. **setTimeout 미정리** (P0 #4)
   - 6개 시나리오에 timerIds 배열 + dispose cleanup 추가
   - base class `Scenario.ts`에 타이머 관리 유틸 추가 검토
   - 예상 공수: ~30분

3. **이벤트 리스너 누적** (P0 #5~6)
   - `GameEngine.ts` — 3개 익명 리스너 → named + dispose 제거
   - 예상 공수: ~15분

---

## 6. 미점검 영역 (세션 4에서 확인)

- [ ] `calibration/` 모듈 (2-Stage 감도 최적화) — GP 연동 로직
- [ ] `zoom_calibration/k_fitting.rs` — k-parameter 피팅 수치 안정성
- [ ] `trajectory/mod.rs` (580줄) — GMM EM 알고리즘 수렴성
- [ ] `input/raw_input.rs` — WinAPI unsafe 블록 안전성
- [ ] E2E 시나리오: 캘리브레이션 시작→GP→수렴→결과 전체 경로
- [ ] 빌드 크기 / 번들 분석
- [ ] 다국어 키 누락 검사

---

> **결론:** GP 엔진은 수학적으로 잘 구현되어 있으나, release 빌드에서 assert 비활성화로 인한 **NaN 전파 → 크래시 체인**이 가장 위험한 P0입니다. Three.js 엔진은 dispose 패턴이 잘 갖춰져 있으나 **setTimeout 미정리**와 **익명 이벤트 리스너 누적**이 시나리오 반복 사용 시 메모리 누수로 이어질 수 있습니다. P0 6건 모두 수정 공수가 적으므로 런칭 전 즉시 수정을 권장합니다.
