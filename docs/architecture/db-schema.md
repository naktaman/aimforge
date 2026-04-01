# AimForge DB 스키마 요약

> SQLite, `src-tauri/src/db/mod.rs`에서 관리

---

## 핵심 테이블

| 테이블 | 역할 |
|--------|------|
| `profiles` | 게임별 프로파일 (sens, cm360, fov, is_reference_game) |
| `hardware_combos` | 마우스 + 패드 + DPI + polling rate |
| `sessions` | 테스트 세션 (mode, type, fps) |
| `trials` | 개별 시행 결과 (scenario_type, score, metrics JSON) |
| `aim_dna` | DNA 프로파일 (23 REAL + type_label) |
| `aim_dna_history` | 피처별 시계열 (feature_name, value, measured_at) |
| `training_prescriptions` | 훈련 처방 (aim_dna_id → weakness → scenario) |
| `crossgame_comparisons` | 크로스게임 비교 (deltas/causes/plan JSON) |
| `crossgame_progress` | 주간 갭 축소 추적 |
| `games` | 게임 프리셋 (yaw, fov_type, movement_ratio) |
| `user_game_profiles` | 유저별 게임 설정 (sens, dpi, fov, keybinds) |
| `calibration_sessions` | 캘리브레이션 세션 |
| `gp_observations` | GP 관측값 (sens → score) |
| `landscape_points` | Performance Landscape 데이터 |
| `zoom_profiles` | 줌 배율 프로파일 |
| `partial_aim_dna` | 캘리브레이션용 부분 DNA |
| `stage_results` | 스테이지별 결과 |
| `crash_logs` | 에러 로그 |
| `user_settings` | 사용자 설정 (key-value) |

## 주요 FK 관계

```
hardware_combos ← profiles → aim_dna → aim_dna_history
                             ↓
                   training_prescriptions

profiles (A) ─┐
              ├─→ crossgame_comparisons → crossgame_progress
profiles (B) ─┘

games → user_game_profiles ← profiles
```
