# AimForge 시나리오 시스템

> `src/engine/scenarios/` 기반

---

## 메인 시나리오 (7종 + 줌 3-phase)

| 시나리오 | 파일 | 메트릭 |
|----------|------|--------|
| Static Flick | FlickScenario.ts | TTT, overshoot, hit, angle, direction, motor_region, click_type |
| Linear Tracking | TrackingScenario.ts | MAD, deviation_variance, phase_lag, velocity_match_ratio |
| Circular Tracking | CircularTrackingScenario.ts | (같은 tracking 메트릭) |
| Stochastic Tracking | StochasticTrackingScenario.ts | (같은 tracking 메트릭) |
| Counter-Strafe Flick | CounterStrafeFlickScenario.ts | (같은 flick 메트릭 + stop_time) |
| Micro-Flick Hybrid | MicroFlickScenario.ts | tracking_mad, flick_hit_rate, reacquire_time |
| Zoom Composite | ZoomCompositeRunner.ts | steady/correction/reacquisition score |

## 배터리 프리셋

| 프리셋 | 비중 분배 |
|--------|-----------|
| TACTICAL | flick 0.25, counter-strafe 0.25, micro-flick 0.15 |
| MOVEMENT | micro-flick 0.20, tracking variants 0.15 |
| BR | zoom_composite 0.35 |
| CUSTOM | 유저 조정 |

## 스테이지 시나리오 (21종)

- Flick: Micro(5-15°), Medium(30-60°), Macro(90-180°)
- Tracking: Close(10-15m), Mid(20-30m), Long(40-60m)
- Switching: Close(15-45°), Wide(60-150°)
- AimDnaScan: 2분 축약 4-phase 배터리

## 점수 공식

```
FlickScore = hitRate × 50 + (1 - avgTtt/3000) × 30 + (1 - avgOvershoot) × 15 + (1 - preFireRatio) × 5
TrackingScore = (1 - mad/0.3) × 60 + velocityMatchRatio × 40
BatteryScore = Σ(weight_i × score_i)
```

---

## v1 피드백 이후 변경사항 (2026-04-02)

### 시나리오 버그 수정

- **타겟 좌표 기준 변경**: 월드 고정 좌표 → 카메라 상대좌표
  - 카메라 회전과 무관하게 타겟이 고정되어 있던 문제 수정
  - 적용 시나리오: Flick Micro/Medium/Macro, Switching Close/Wide, Tracking Close/Mid/Long (8개 전부)

### 사격 피드백 시스템 (`src/engine/AudioManager.ts`, `src/components/overlays/ShootingFeedback.tsx`)

| 피드백 유형 | 구현 방식 |
|-------------|-----------|
| 발사음 | Web Audio API — noise burst + low-freq punch |
| 히트마커 | X 형태 시각 피드백 (CSS 애니메이션) |
| 미스마커 | O 형태 시각 피드백 (CSS 애니메이션) |
| 머즐플래시 | 화면 밝기 펄스 CSS 애니메이션 |

### 반동 시스템 (`GameEngine.ts` 내 카메라 반동 적용)

| 프리셋 | 수직 반동 | 수평 반동 | 용도 |
|--------|-----------|-----------|------|
| light | 낮음 | 최소 | 권총 |
| heavy | 높음 | 중간 | 라이플 |
| shotgun | 매우 높음 | 높음 | 산탄총 |

- OFF 토글 지원
- 시간 기반 자동 회복 (recoil recovery)
- 카메라에 직접 적용 (수직 pitch + 수평 yaw)

### 총기 뷰모델 + 발사 모드 시스템

**총기 뷰모델** (`src/engine/WeaponViewModel.ts`)
- Three.js 프로시저럴 메시 — 권총/라이플 2종
- 별도 오버레이 씬 + 카메라 (월드 오브젝트에 가려지지 않음)
- 발사 애니메이션 (반동 킥백 + 복귀)

**발사 모드** (`src/engine/FireModeController.ts`, `src/components/overlays/FireModeIndicator.tsx`)

| 모드 | 동작 | 조작 |
|------|------|------|
| Semi (단발) | 클릭당 1발 | 기본값 |
| Auto (연발) | 홀드 시 연속 발사 | B키 / UI 드롭다운 |
| Burst (점사) | 클릭당 3발 | B키 / UI 드롭다운 |

- RPM 기반 연사 간격 제어 (밀리초 단위)
