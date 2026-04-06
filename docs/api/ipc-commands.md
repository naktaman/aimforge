# IPC 커맨드 API 레퍼런스

> 자동 생성 — `src-tauri/src/` 기준
> 총 **107개** 커맨드

## 목차

- [앱 정보](#앱-정보)
- [데이터베이스](#데이터베이스)
- [감도 캘리브레이션](#감도-캘리브레이션)
- [크로스게임 변환](#크로스게임-변환)
- [Aim DNA 분석](#aim-dna-분석)
- [트라젝토리 분석](#트라젝토리-분석)
- [훈련 처방](#훈련-처방)
- [무빙 편집기](#무빙-편집기)
- [게임 DB 조회](#게임-db-조회)
- [하드웨어 비교](#하드웨어-비교)
- [FOV 프로필](#fov-프로필)
- [줌 캘리브레이션](#줌-캘리브레이션)
- [입력 시스템](#입력-시스템)

---

## 앱 정보

### `get_app_info`
- **파일**: `lib.rs`
- **파라미터**: 없음
- **반환**: `serde_json::Value` (`{ name, version }`)
- **설명**: 앱 이름 및 버전 정보 반환

---

## 데이터베이스

> **파일**: `db/commands.rs`

### `start_session`
- **파라미터**: `profile_id: i64`, `mode: String`, `session_type: String`
- **반환**: `Result<i64, PublicError>`
- **설명**: 새 훈련 세션 시작 — 세션 ID 반환

### `save_trial`
- **파라미터**: `session_id: i64`, `scenario_type: String`, `cm360_tested: f64`, `composite_score: f64`, `raw_metrics: String`, `mouse_trajectory: String`, `click_events: String`, `angle_breakdown: String`, `motor_breakdown: String`
- **반환**: `Result<i64, PublicError>`
- **설명**: 트라이얼 결과 저장 — 트라이얼 ID 반환

### `end_session`
- **파라미터**: `session_id: i64`, `total_trials: i64`, `avg_fps: f64`, `monitor_refresh: i64`
- **반환**: `Result<(), PublicError>`
- **설명**: 세션 종료 처리 (종료 시각 + FPS 기록)

### `log_crash`
- **파라미터**: `error_type: String`, `error_message: String`, `stack_trace: Option<String>`, `context: String`, `app_version: String`
- **반환**: `Result<i64, PublicError>`
- **설명**: 크래시 로그 로컬 DB에 저장

### `get_crash_logs`
- **파라미터**: `limit: Option<i64>` (기본 50)
- **반환**: `Result<Vec<CrashLogRow>, PublicError>`
- **설명**: 저장된 크래시 로그 조회

### `get_daily_stats`
- **파라미터**: `profile_id: i64`, `days: Option<i64>` (기본 30)
- **반환**: `Result<Vec<DailyStatRow>, PublicError>`
- **설명**: 일별 훈련 통계 조회

### `get_skill_progress`
- **파라미터**: `profile_id: i64`
- **반환**: `Result<Vec<SkillProgressRow>, PublicError>`
- **설명**: 스킬별 진행도 조회

### `save_user_setting`
- **파라미터**: `profile_id: i64`, `key: String`, `value: String`
- **반환**: `Result<(), PublicError>`
- **설명**: 사용자 설정 키-값 저장 (upsert)

### `get_user_setting`
- **파라미터**: `profile_id: i64`, `key: String`
- **반환**: `Result<Option<String>, PublicError>`
- **설명**: 특정 키의 사용자 설정 조회

### `get_all_user_settings`
- **파라미터**: `profile_id: i64`
- **반환**: `Result<Vec<(String, String)>, PublicError>`
- **설명**: 프로필의 모든 사용자 설정 조회

### `create_game_profile`
- **파라미터**: `profile_id: i64`, `game_id: String`, `game_name: String`, `custom_sens: f64`, `custom_dpi: i64`, `custom_fov: f64`, `custom_cm360: f64`, `keybinds_json: String`
- **반환**: `Result<i64, PublicError>`
- **설명**: 게임 프로필 생성 — ID 반환

### `get_game_profiles`
- **파라미터**: `profile_id: i64`
- **반환**: `Result<Vec<GameProfileRow>, PublicError>`
- **설명**: 프로필에 연결된 게임 프로필 목록 조회

### `update_game_profile`
- **파라미터**: `id: i64`, `custom_sens: f64`, `custom_dpi: i64`, `custom_fov: f64`, `custom_cm360: f64`, `keybinds_json: String`
- **반환**: `Result<(), PublicError>`
- **설명**: 게임 프로필 수정

### `delete_game_profile`
- **파라미터**: `id: i64`
- **반환**: `Result<(), PublicError>`
- **설명**: 게임 프로필 삭제

### `set_active_game_profile`
- **파라미터**: `profile_id: i64`, `game_profile_id: i64`
- **반환**: `Result<(), PublicError>`
- **설명**: 활성 게임 프로필 설정

### `create_routine`
- **파라미터**: `profile_id: i64`, `name: String`, `description: String`
- **반환**: `Result<i64, PublicError>`
- **설명**: 훈련 루틴 생성 — ID 반환

### `get_routines`
- **파라미터**: `profile_id: i64`
- **반환**: `Result<Vec<RoutineRow>, PublicError>`
- **설명**: 루틴 목록 조회

### `delete_routine`
- **파라미터**: `id: i64`
- **반환**: `Result<(), PublicError>`
- **설명**: 루틴 삭제

### `add_routine_step`
- **파라미터**: `routine_id: i64`, `step_order: i64`, `stage_type: String`, `duration_ms: i64`, `config_json: String`
- **반환**: `Result<i64, PublicError>`
- **설명**: 루틴 스텝 추가 — 총 루틴 소요 시간 자동 갱신

### `get_routine_steps`
- **파라미터**: `routine_id: i64`
- **반환**: `Result<Vec<RoutineStepRow>, PublicError>`
- **설명**: 루틴 스텝 목록 조회

### `remove_routine_step`
- **파라미터**: `id: i64`, `routine_id: i64`
- **반환**: `Result<(), PublicError>`
- **설명**: 루틴 스텝 삭제 — 총 루틴 소요 시간 자동 갱신

### `swap_routine_step_order`
- **파라미터**: `step_id_a: i64`, `step_id_b: i64`, `routine_id: i64`
- **반환**: `Result<(), PublicError>`
- **설명**: 루틴 스텝 순서 교환

### `export_database`
- **파라미터**: 없음
- **반환**: `Result<String, PublicError>`
- **설명**: DB 파일 경로 반환 (내보내기용)

### `get_weekly_stats`
- **파라미터**: `profile_id: i64`, `weeks: Option<i64>` (기본 12)
- **반환**: `Result<Vec<WeeklyStatRow>, PublicError>`
- **설명**: 주별 통계 조회

### `archive_old_trials`
- **파라미터**: `days_old: Option<i64>` (기본 90)
- **반환**: `Result<usize, PublicError>`
- **설명**: N일 이전 트라이얼의 raw 데이터(trajectory, metrics) 경량화 — 처리 건수 반환

### `optimize_database`
- **파라미터**: 없음
- **반환**: `Result<(), PublicError>`
- **설명**: DB ANALYZE + optimize 실행

---

## 감도 캘리브레이션

> **파일**: `calibration/commands.rs`
> GP Bayesian Optimization 기반 최적 cm/360 탐색

### `start_calibration`
- **파라미터**: `profile_id: i64`, `mode: String`, `current_cm360: f64`, `game_category: String`, `convergence_mode: Option<String>` (`"quick"` | `"deep"` | `"obsessive"`, 기본 `"quick"`)
- **반환**: `Result<i64, PublicError>`
- **설명**: 캘리브레이션 시작 — CalibrationEngine 생성 + DB 세션 저장, 세션 ID 반환

### `get_next_trial_sens`
- **파라미터**: 없음
- **반환**: `Result<NextTrialAction, PublicError>`
- **설명**: GP 베이지안 최적화로 다음 테스트할 cm/360 값 조회

### `submit_calibration_trial`
- **파라미터**: `cm360: f64`, `score: f64`, `metrics_json: Option<String>`
- **반환**: `Result<TrialFeedback, PublicError>`
- **설명**: 트라이얼 결과 제출 — GP 모델 업데이트 + 피드백 반환

### `get_calibration_status`
- **파라미터**: 없음
- **반환**: `Result<CalibrationStatus, PublicError>`
- **설명**: 현재 캘리브레이션 진행 상태 조회 (트라이얼 수, 수렴 여부 등)

### `finalize_calibration`
- **파라미터**: 없음
- **반환**: `Result<CalibrationResult, PublicError>`
- **설명**: 캘리브레이션 최종 결과 생성 (최적 cm/360 + 신뢰 구간)

### `cancel_calibration`
- **파라미터**: 없음
- **반환**: `Result<(), PublicError>`
- **설명**: 캘리브레이션 취소 — 엔진 상태 초기화

---

## 크로스게임 변환

> **파일**: `crossgame/commands.rs`

### `compare_game_dna`
- **파라미터**: `ref_profile_id: i64`, `target_profile_id: i64`, `ref_game_movement_ratio: Option<f64>`, `target_game_movement_ratio: Option<f64>`
- **반환**: `Result<CrossGameComparison, PublicError>`
- **설명**: 두 게임 프로파일의 Aim DNA 비교 — 피처 갭 + 원인 분석 + 개선 플랜 생성

### `predict_crossgame_timeline`
- **파라미터**: `ref_profile_id: i64`, `target_profile_id: i64`, `adaptation_rate: Option<f64>`, `weekly_training_hours: Option<f64>`
- **반환**: `Result<TimelinePrediction, PublicError>`
- **설명**: 크로스게임 적응 소요 일수 예측

### `record_crossgame_progress`
- **파라미터**: `comparison_id: i64`, `week_number: i64`, `metrics: String`, `gap_reduction_pct: f64`
- **반환**: `Result<i64, PublicError>`
- **설명**: 주간 크로스게임 적응 진행 기록 저장

### `get_cross_game_history_cmd`
- **파라미터**: `profile_id: i64`, `limit: Option<i64>` (기본 20)
- **반환**: `Result<Vec<CrossGameComparisonSummary>, PublicError>`
- **설명**: 프로파일별 크로스게임 비교 히스토리 조회

### `generate_crossgame_prescriptions_cmd`
- **파라미터**: `ref_profile_id: i64`, `target_profile_id: i64`, `ref_game_movement_ratio: Option<f64>`, `target_game_movement_ratio: Option<f64>`
- **반환**: `Result<Vec<TrainingPrescription>, PublicError>`
- **설명**: 크로스게임 DNA 갭 기반 훈련 처방 생성 + DB 캐싱

### `convert_crossgame_zoom_sensitivity`
- **파라미터**: `source_game: String`, `target_game: String`, `source_sens: f64`, `optic: String`, `zoom_ratio: f64`, `k_value: Option<f64>`, `piecewise_k: Option<Vec<PiecewiseK>>`, `aim_type_k: Option<AimTypeKResult>`, `game_zoom_profile: Option<GameZoomProfile>`
- **반환**: `Result<CrossgameZoomResult, PublicError>`
- **설명**: 소스 게임의 줌 감도를 타겟 게임의 동일 배율 줌으로 변환 (k-parameter 모델)

---

## Aim DNA 분석

> **파일**: `aim_dna/commands.rs`

### `compute_aim_dna_cmd`
- **파라미터**: `params: ComputeAimDnaParams` (`input: BatteryMetricsInput`)
- **반환**: `Result<AimDnaProfile, PublicError>`
- **설명**: 배터리 메트릭 → 26개 피처 계산 + DB 저장 + 5축 레이더 스냅샷 자동 저장 + 레퍼런스 게임 재감지

### `get_aim_dna`
- **파라미터**: `profile_id: i64`
- **반환**: `Result<Option<AimDnaProfile>, PublicError>`
- **설명**: 프로파일의 최신 Aim DNA 프로파일 조회

### `get_aim_dna_history`
- **파라미터**: `profile_id: i64`, `feature_name: Option<String>`
- **반환**: `Result<Vec<AimDnaHistoryEntry>, PublicError>`
- **설명**: Aim DNA 피처 변화 히스토리 조회 (전체 또는 특정 피처)

### `get_sessions_history`
- **파라미터**: `profile_id: i64`, `limit: Option<i64>` (기본 50)
- **반환**: `Result<Vec<SessionSummary>, PublicError>`
- **설명**: 세션 히스토리 목록 조회

### `get_session_detail`
- **파라미터**: `session_id: i64`
- **반환**: `Result<SessionDetail, PublicError>`
- **설명**: 세션 상세 정보 + 트라이얼 목록 조회

### `get_dna_trend_cmd`
- **파라미터**: `profile_id: i64`
- **반환**: `Result<DnaTrendResult, PublicError>`
- **설명**: DNA 시계열 추세 분석 — 재교정 필요 여부 판단

### `detect_reference_game_cmd`
- **파라미터**: 없음
- **반환**: `Result<ReferenceGameResult, PublicError>`
- **설명**: 모든 프로파일 DNA 비교 → 레퍼런스 게임 자동 감지 + DB 반영

### `get_dna_snapshots_cmd`
- **파라미터**: `profile_id: i64`, `limit: Option<i64>` (기본 30)
- **반환**: `Result<Vec<DnaSnapshot>, PublicError>`
- **설명**: DNA 시계열 5축 레이더 스냅샷 목록 조회

### `save_change_event_cmd`
- **파라미터**: `profile_id: i64`, `change_type: String`, `before_value: Option<String>`, `after_value: String`, `description: String`
- **반환**: `Result<i64, PublicError>`
- **설명**: 변경점 이벤트 저장 (기어/감도/그립/자세 변경 시 호출)

### `get_change_events_cmd`
- **파라미터**: `profile_id: i64`, `limit: Option<i64>` (기본 50)
- **반환**: `Result<Vec<DnaChangeEvent>, PublicError>`
- **설명**: 변경점 이벤트 목록 조회

### `compare_snapshots_cmd`
- **파라미터**: `before_id: i64`, `after_id: i64`, `profile_id: i64`
- **반환**: `Result<SnapshotComparison, PublicError>`
- **설명**: 두 DNA 스냅샷 비교 — 축별 변화(delta_abs, delta_pct) + 자동 인사이트 생성

### `detect_stagnation_cmd`
- **파라미터**: `profile_id: i64`
- **반환**: `Result<StagnationResult, PublicError>`
- **설명**: 최근 5회 측정에서 변화 < 2%인 축 탐지 + 정체기 탈출 제안 생성

---

## 트라젝토리 분석

> **파일**: `trajectory/commands.rs`

### `analyze_trajectory_cmd`
- **파라미터**: `trial_id: i64`
- **반환**: `Result<TrajectoryAnalysisResult, PublicError>`
- **설명**: 트라이얼 궤적 전체 분석 — 클릭 벡터 추출 + GMM + 감도 진단

### `get_click_vectors_cmd`
- **파라미터**: `trial_id: i64`
- **반환**: `Result<Vec<ClickVector>, PublicError>`
- **설명**: 클릭 벡터만 경량 추출 (분석 없이 원시 벡터만 필요할 때)

---

## 훈련 처방

> **파일**: `training/commands.rs`

### `generate_training_prescriptions`
- **파라미터**: `profile_id: i64`
- **반환**: `Result<Vec<TrainingPrescription>, PublicError>`
- **설명**: 최신 Aim DNA 기반 훈련 처방 생성 + DB 저장

### `get_stage_recommendations`
- **파라미터**: `profile_id: i64`
- **반환**: `Result<Vec<StageRecommendation>, PublicError>`
- **설명**: Aim DNA 약점 기반 추천 스테이지 목록 조회

### `get_benchmark_preset_list`
- **파라미터**: 없음
- **반환**: `Result<serde_json::Value, PublicError>`
- **설명**: 벤치마크 프리셋 목록 조회 (타겟 크기, 속도, 반응 윈도우, 카운트)

### `submit_stage_result`
- **파라미터**: `result: StageResult` (`profile_id`, `stage_type`, `category`, `score`, `accuracy`, `avg_ttk_ms`, `avg_reaction_ms`, `avg_overshoot_deg`, `avg_undershoot_deg`, `tracking_mad`, `raw_metrics`, `difficulty`)
- **반환**: `Result<serde_json::Value, PublicError>` (`{ stage_result_id, features_updated }`)
- **설명**: 스테이지 결과 제출 → DB 저장 + DNA 피처 히스토리 업데이트 + 일별/스킬 통계 집계

### `calculate_adaptive_difficulty`
- **파라미터**: `current_difficulty: DifficultyConfig`, `recent_accuracy: f64`
- **반환**: `Result<DifficultyConfig, PublicError>`
- **설명**: 최근 정확도 기반 적응형 난이도 계산

### `get_stage_results`
- **파라미터**: `profile_id: i64`, `limit: Option<i64>` (기본 50), `stage_type: Option<String>`
- **반환**: `Result<Vec<StageResultRow>, PublicError>`
- **설명**: 스테이지 결과 히스토리 조회 (전체 또는 타입 필터)

### `calculate_readiness_score`
- **파라미터**: `params: ReadinessInput` (`profile_id: i64`, 기타 컨디션 항목)
- **반환**: `Result<ReadinessResult, PublicError>`
- **설명**: Readiness Score 계산 + DB 저장 — 기준 DNA 대비 컨디션 평가

### `get_readiness_history`
- **파라미터**: `profile_id: i64`, `limit: Option<i64>` (기본 30)
- **반환**: `Result<Vec<ReadinessScoreRow>, PublicError>`
- **설명**: Readiness Score 히스토리 조회

### `start_style_transition`
- **파라미터**: `profile_id: i64`, `from_type: String`, `to_type: String`, `target_sens_range: String`
- **반환**: `Result<serde_json::Value, PublicError>` (`{ transition_id }`)
- **설명**: 에임 스타일 전환 시작 — 기존 활성 전환 있으면 완료 처리 후 새 레코드 생성

### `get_style_transition_status`
- **파라미터**: `profile_id: i64`
- **반환**: `Result<serde_json::Value, PublicError>` (`{ transition, progress }`)
- **설명**: 스타일 전환 상태 조회 + 현재 DNA 대비 수렴도 평가 + Phase 자동 갱신

### `update_style_transition`
- **파라미터**: `profile_id: i64`, `action: String` (`"complete"` | `"detect_plateau"`)
- **반환**: `Result<serde_json::Value, PublicError>`
- **설명**: 스타일 전환 수동 업데이트 (완료 처리 또는 정체기 마킹)

---

## 무빙 편집기

> **파일**: `movement/commands.rs`

### `get_movement_presets`
- **파라미터**: 없음
- **반환**: `Vec<MovementPreset>`
- **설명**: 10개 게임 기본 무브먼트 프리셋 반환

### `get_movement_profiles`
- **파라미터**: `game_id: i64`
- **반환**: `Result<Vec<MovementProfileRow>, PublicError>`
- **설명**: DB에서 게임별 무브먼트 프로필 조회

### `save_movement_profile`
- **파라미터**: `game_id: i64`, `name: String`, `max_speed: f64`, `stop_time: f64`, `accel_type: String`, `air_control: f64`, `cs_bonus: f64`
- **반환**: `Result<i64, PublicError>`
- **설명**: 커스텀 무브먼트 프로필 저장 — ID 반환

### `update_movement_profile`
- **파라미터**: `id: i64`, `name: String`, `max_speed: f64`, `stop_time: f64`, `accel_type: String`, `air_control: f64`, `cs_bonus: f64`
- **반환**: `Result<(), PublicError>`
- **설명**: 무브먼트 프로필 수정

### `delete_movement_profile`
- **파라미터**: `id: i64`
- **반환**: `Result<(), PublicError>`
- **설명**: 무브먼트 프로필 삭제

### `calculate_weighted_recommendation`
- **파라미터**: `static_optimal: f64`, `moving_optimal: f64`, `movement_ratio: f64`
- **반환**: `WeightedRecommendation`
- **설명**: 정적/무빙 최적 cm/360 + movement_ratio → 가중 최종 감도 추천

### `export_movement_profile`
- **파라미터**: `game_id: String`, `name: String`, `max_speed: f64`, `stop_time: f64`, `accel_type: String`, `air_control: f64`, `cs_bonus: f64`
- **반환**: `Result<String, PublicError>`
- **설명**: 무브먼트 프로필을 JSON 파일로 내보내기 — `app_data_dir/exports/` 저장, 파일 경로 반환

### `import_movement_profile_from_string`
- **파라미터**: `json_string: String`
- **반환**: `Result<MovementPreset, PublicError>`
- **설명**: JSON 문자열에서 무브먼트 프로필 가져오기

### `calibrate_max_speed`
- **파라미터**: `game_id: String`, `distance_units: f64`, `measured_time_sec: f64`
- **반환**: `Result<CalibrateMaxSpeedResult, PublicError>` (`{ calculated_max_speed, distance_used }`)
- **설명**: 벽 도달 시간 측정값으로 max_speed 자동 계산

---

## 게임 DB 조회

> **파일**: `game_db/commands.rs`, `game_db/recoil_commands.rs`

### `get_available_games`
- **파라미터**: 없음
- **반환**: `Vec<GamePreset>`
- **설명**: 지원 게임 목록 반환 (프론트엔드 게임 선택 UI용)

### `convert_sensitivity`
- **파라미터**: `from_game_id: String`, `to_game_id: String`, `sens: f64`, `dpi: u32`
- **반환**: `Result<SensitivityConversion, PublicError>`
- **설명**: 게임 간 감도 변환 — `from_game` → cm/360 → `to_game` 감도

### `convert_all_methods`
- **파라미터**: `from_game_id: String`, `to_game_id: String`, `sens: f64`, `dpi: u32`, `aspect_ratio: Option<f64>`
- **반환**: `Result<AllMethodsConversion, PublicError>`
- **설명**: 6가지 변환 방식 동시 계산 (MDM 0/56.25/75/100%, Viewspeed H/V)

### `snap_sensitivity`
- **파라미터**: `game_id: String`, `target_cm360: f64`, `dpi: u32`
- **반환**: `Result<SnappedSensitivity, PublicError>`
- **설명**: 최적 cm/360에 가장 가까운 게임 감도 후보 계산 (floor/ceil/추천)

### `get_recoil_patterns`
- **파일**: `game_db/recoil_commands.rs`
- **파라미터**: `game_id: Option<i64>`
- **반환**: `Result<Vec<RecoilPatternRow>, PublicError>`
- **설명**: 반동 패턴 목록 조회 (게임 필터 선택)

### `save_recoil_pattern`
- **파일**: `game_db/recoil_commands.rs`
- **파라미터**: `game_id: i64`, `weapon_name: String`, `pattern_points: String`, `randomness: f64`, `vertical: f64`, `horizontal: f64`, `rpm: i64`
- **반환**: `Result<i64, PublicError>`
- **설명**: 커스텀 반동 패턴 저장 — ID 반환

### `update_recoil_pattern`
- **파일**: `game_db/recoil_commands.rs`
- **파라미터**: `id: i64`, `weapon_name: String`, `pattern_points: String`, `randomness: f64`, `vertical: f64`, `horizontal: f64`, `rpm: i64`
- **반환**: `Result<(), PublicError>`
- **설명**: 반동 패턴 수정

### `delete_recoil_pattern`
- **파일**: `game_db/recoil_commands.rs`
- **파라미터**: `id: i64`
- **반환**: `Result<(), PublicError>`
- **설명**: 커스텀 반동 패턴 삭제

---

## 하드웨어 비교

> **파일**: `hardware/commands.rs`

### `save_hardware_combo`
- **파라미터**: `mouse_model: String`, `dpi: i64`, `verified_dpi: Option<i64>`, `polling_rate: Option<i64>`, `mousepad_model: Option<String>`
- **반환**: `Result<i64, PublicError>`
- **설명**: 하드웨어 콤보 등록 (마우스/DPI/폴링레이트/마우스패드) — ID 반환

### `get_hardware_combos`
- **파라미터**: 없음
- **반환**: `Result<Vec<HardwareComboRow>, PublicError>`
- **설명**: 전체 하드웨어 콤보 조회

### `update_hardware_combo`
- **파라미터**: `id: i64`, `mouse_model: String`, `dpi: i64`, `verified_dpi: Option<i64>`, `polling_rate: Option<i64>`, `mousepad_model: Option<String>`
- **반환**: `Result<(), PublicError>`
- **설명**: 하드웨어 콤보 수정

### `delete_hardware_combo`
- **파라미터**: `id: i64`
- **반환**: `Result<(), PublicError>`
- **설명**: 하드웨어 콤보 삭제

### `compare_hardware_combos`
- **파라미터**: `profile_a_id: i64`, `profile_b_id: i64`
- **반환**: `Result<HardwareComparison, PublicError>`
- **설명**: 두 프로필의 하드웨어 콤보 + DNA + 최적 cm/360 비교 분석

---

## FOV 프로필

> **파일**: `fov_profile/commands.rs`

### `save_fov_test_result`
- **파라미터**: `profile_id: i64`, `fov_tested: f64`, `scenario_type: String`, `score: f64`, `peripheral_score: Option<f64>`, `center_score: Option<f64>`
- **반환**: `Result<i64, PublicError>`
- **설명**: FOV 테스트 결과 저장 — ID 반환

### `get_fov_test_results`
- **파라미터**: `profile_id: i64`
- **반환**: `Result<Vec<FovProfileRow>, PublicError>`
- **설명**: FOV 테스트 결과 목록 조회

### `compare_fov_profiles`
- **파라미터**: `profile_id: i64`
- **반환**: `Result<Option<FovRecommendation>, PublicError>`
- **설명**: FOV 비교 분석 실행 — DB 데이터 로드 후 최적 FOV 추천

### `delete_fov_test_results`
- **파라미터**: `profile_id: i64`
- **반환**: `Result<(), PublicError>`
- **설명**: 프로파일의 FOV 테스트 결과 전체 삭제

---

## 줌 캘리브레이션

> **파일**: `zoom_calibration/commands.rs`
> k-parameter 모델 기반 줌 배율 최적화

### `get_zoom_profiles`
- **파라미터**: `game_id: i64`
- **반환**: `Result<Vec<ZoomProfileRow>, PublicError>`
- **설명**: 게임의 줌 프로파일 목록 조회 (스코프/줌 배율 등)

### `start_zoom_calibration`
- **파라미터**: `profile_id: i64`, `game_id: i64`, `hipfire_fov: f64`, `base_cm360: f64`, `selected_profile_ids: Vec<i64>`, `convergence_mode: Option<String>`, `calibration_mode: Option<String>`
- **반환**: `Result<(), PublicError>`
- **설명**: 줌 캘리브레이션 시작 — ZoomCalibrationEngine 초기화

### `get_next_zoom_trial`
- **파라미터**: 없음
- **반환**: `Result<Option<ZoomTrialAction>, PublicError>`
- **설명**: 다음 줌 트라이얼 조회 (어떤 스코프/배율/페이즈를 테스트할지)

### `submit_zoom_trial`
- **파라미터**: `phase: String` (`"steady"` | `"correction"` | `"zoomout"`), `score: f64`
- **반환**: `Result<ZoomTrialFeedback, PublicError>`
- **설명**: 줌 트라이얼 결과 제출 — GP 모델 업데이트 + 피드백

### `finalize_zoom_calibration`
- **파라미터**: 없음
- **반환**: `Result<ZoomCalibrationResult, PublicError>`
- **설명**: 줌 캘리브레이션 최종 결과 생성 + DB 저장 (배율 결과 + k 값 피팅)

### `adjust_k`
- **파라미터**: `delta: f64`
- **반환**: `Result<AdjustedPredictions, PublicError>`
- **설명**: k 값 수동 미세 조정 — 조정된 배율 예측 반환

### `get_zoom_calibration_status`
- **파라미터**: 없음
- **반환**: `Result<ZoomCalibrationStatus, PublicError>`
- **설명**: 줌 캘리브레이션 현재 상태 조회

### `start_comparator`
- **파라미터**: `profile_id: i64`, `zoom_profile_id: i64`, `multipliers: Vec<f64>`
- **반환**: `Result<(), PublicError>`
- **설명**: 변환 방식 비교기 시작 (6개 방식별 배율 목록 전달)

### `get_next_comparator_trial`
- **파라미터**: `multipliers: Vec<f64>`
- **반환**: `Result<Option<ComparatorTrialAction>, PublicError>`
- **설명**: 비교기 다음 트라이얼 조회

### `submit_comparator_trial`
- **파라미터**: `steady_score: f64`, `correction_score: f64`, `zoomout_score: f64`, `composite_score: f64`
- **반환**: `Result<ComparatorTrialFeedback, PublicError>`
- **설명**: 비교기 트라이얼 결과 제출

### `finalize_comparator`
- **파라미터**: 없음
- **반환**: `Result<ComparatorResult, PublicError>`
- **설명**: 비교기 최종 결과 생성 + DB 저장 — 방식별 점수/p-value/effect size 포함

### `save_landscape`
- **파라미터**: `profile_id: i64`, `calibration_session_id: Option<i64>`, `gp_mean_curve: String`, `confidence_bands: String`, `scenario_overlays: String`, `bimodal_peaks: String`
- **반환**: `Result<i64, PublicError>`
- **설명**: Performance Landscape 데이터 저장 — ID 반환

---

## 입력 시스템

> **파일**: `input/commands.rs`
> Windows Raw Input API 기반 마우스 입력 처리

### `get_mouse_acceleration_status`
- **파라미터**: 없음
- **반환**: `MouseAccelStatus`
- **설명**: 마우스 가속 활성화 여부 확인 (온보딩 안내용)

### `check_dpi`
- **파라미터**: `claimed_dpi: u32`, `total_counts: i64`, `distance_cm: f64`
- **반환**: `Result<DpiVerification, PublicError>`
- **설명**: DPI 검증 — 실측 드래그 거리로 실제 DPI 계산, 오차 기준: <5% 통과 / 5~15% 경고 / >15% 실패

### `start_mouse_capture`
- **파라미터**: 없음
- **반환**: `Result<String, PublicError>`
- **설명**: Raw Input 캡처 시작 — 백그라운드 스레드 + crossbeam 채널(버퍼 2000)

### `stop_mouse_capture`
- **파라미터**: 없음
- **반환**: `Result<String, PublicError>`
- **설명**: Raw Input 캡처 중지 — 캡처 스레드 종료 대기

### `drain_mouse_batch`
- **파라미터**: 없음
- **반환**: `Result<MouseBatch, PublicError>`
- **설명**: 누적 마우스 이벤트 배치 드레인 — rAF당 한 번 호출, `total_dx`/`total_dy` 합산 제공

---

## 오류 타입

모든 `Result<T, PublicError>` 반환 커맨드는 실패 시 아래 구조의 에러를 반환합니다:

```json
{
  "message": "사용자에게 표시할 에러 메시지",
  "code": "ERROR_CODE"
}
```

주요 에러 코드:
- `"VALIDATION"` — 입력값 검증 실패 (범위 초과, 빈 문자열 등)
- `"NOT_FOUND"` — 대상 리소스 없음
- `"DATABASE"` — DB 조작 오류
- `"INTERNAL"` — 내부 처리 오류
- `"LOCK"` — 상태 잠금(Mutex) 획득 실패
