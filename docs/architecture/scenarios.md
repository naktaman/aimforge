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
