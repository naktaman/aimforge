/// DB 모듈 — Database 구조체 + 도메인별 impl 분리
///
/// 하위 모듈 구성:
/// - sessions: 세션 + 트라이얼 CRUD
/// - calibration: 캘리브레이션 + GP + 줌
/// - dna: Aim DNA + 스냅샷 + 변경점 이벤트
/// - training: 훈련 처방 + 크로스게임 + 스테이지 + Readiness + Style Transition
/// - profiles: 사용자 설정 + 게임 프로필 + 루틴
/// - hardware: 무브먼트 + 반동 + FOV + 하드웨어 콤보
/// - stats: 통계 집계 + 크래시 로그 + 아카이브 + DB 최적화
pub mod commands;
mod sessions;
mod calibration;
mod dna;
mod training;
mod profiles;
mod hardware;
mod stats;

use rusqlite::{Connection, Result};
use serde::Serialize;
use std::path::Path;

/// 줌 프로파일 DB 행
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ZoomProfileRow {
    pub id: i64,
    pub game_id: i64,
    pub scope_name: String,
    pub zoom_ratio: f64,
    pub fov_override: Option<f64>,
    pub steady_weight: f64,
    pub transition_weight: f64,
    pub zoomout_weight: f64,
}

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new(path: &Path) -> Result<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
        Ok(Database { conn })
    }

    pub fn initialize_schema(&self) -> Result<()> {
        self.conn.execute_batch(SCHEMA_SQL)?;
        self.seed_defaults()?;
        Ok(())
    }

    /// 기본 게임 + 기본 프로필 시드 — 이미 존재하면 무시 (INSERT OR IGNORE)
    fn seed_defaults(&self) -> Result<()> {
        // 기본 게임 (CS2) — 다른 테이블의 FK 참조용
        self.conn.execute(
            "INSERT OR IGNORE INTO games (id, name, yaw_formula, fov_default, fov_type, sens_step, movement_ratio) \
             VALUES (1, 'CS2', '0.022', 106.26, 'horizontal', 0.01, 0.34)",
            [],
        )?;

        // 기본 프로필 — 프론트엔드가 profile_id=1 하드코딩 참조
        self.conn.execute(
            "INSERT OR IGNORE INTO profiles (id, game_id, current_sens, current_cm360, calibration_mode) \
             VALUES (1, 1, 1.0, 46.18, 'explore')",
            [],
        )?;

        Ok(())
    }

    pub fn conn(&self) -> &Connection {
        &self.conn
    }
}

// ═══════════════════════════════════════════════════
// 도메인별 struct 정의 — 하위 모듈에서 사용
// ═══════════════════════════════════════════════════

/// 무브먼트 프로필 행
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MovementProfileRow {
    pub id: i64,
    pub game_id: i64,
    pub name: String,
    pub max_speed: f64,
    pub stop_time: f64,
    pub accel_type: String,
    pub air_control: f64,
    pub cs_bonus: f64,
    pub is_custom: bool,
}

/// 반동 패턴 행
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoilPatternRow {
    pub id: i64,
    pub game_id: i64,
    pub weapon_name: String,
    pub pattern_points: String,
    pub randomness: f64,
    pub vertical: f64,
    pub horizontal: f64,
    pub rpm: i64,
    pub is_custom: bool,
}

/// FOV 프로필 행
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FovProfileRow {
    pub id: i64,
    pub profile_id: i64,
    pub fov_tested: f64,
    pub scenario_type: String,
    pub score: f64,
    pub peripheral_score: Option<f64>,
    pub center_score: Option<f64>,
    pub created_at: String,
}

/// 하드웨어 콤보 행
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HardwareComboRow {
    pub id: i64,
    pub mouse_model: String,
    pub dpi: i64,
    pub verified_dpi: Option<i64>,
    pub polling_rate: Option<i64>,
    pub mousepad_model: Option<String>,
    pub created_at: String,
}

/// 크래시 로그 행
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CrashLogRow {
    pub id: i64,
    pub error_type: String,
    pub error_message: String,
    pub stack_trace: Option<String>,
    pub context: String,
    pub app_version: String,
    pub created_at: String,
}

/// 일별 통계 행
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyStatRow {
    pub id: i64,
    pub profile_id: i64,
    pub stat_date: String,
    pub scenario_type: String,
    pub avg_score: f64,
    pub max_score: f64,
    pub sessions_count: i64,
    pub total_trials: i64,
    pub total_time_ms: i64,
    pub avg_accuracy: f64,
}

/// 주별 통계 행
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WeeklyStatRow {
    pub profile_id: i64,
    pub week_start: String,
    pub scenario_type: String,
    pub avg_score: f64,
    pub max_score: f64,
    pub sessions_count: i64,
    pub total_trials: i64,
    pub total_time_ms: i64,
    pub avg_accuracy: f64,
}

/// 스킬 진행도 행
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillProgressRow {
    pub id: i64,
    pub profile_id: i64,
    pub stage_type: String,
    pub rolling_avg_score: f64,
    pub best_score: f64,
    pub total_sessions: i64,
    pub total_time_ms: i64,
    pub last_updated: String,
}

/// 게임 프로필 행
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameProfileRow {
    pub id: i64,
    pub profile_id: i64,
    pub game_id: String,
    pub game_name: String,
    pub custom_sens: f64,
    pub custom_dpi: i64,
    pub custom_fov: f64,
    pub custom_cm360: f64,
    pub keybinds_json: String,
    pub is_active: bool,
    pub created_at: String,
}

/// 루틴 행
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RoutineRow {
    pub id: i64,
    pub profile_id: i64,
    pub name: String,
    pub description: String,
    pub total_duration_ms: i64,
    pub created_at: String,
}

/// 루틴 스텝 행
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RoutineStepRow {
    pub id: i64,
    pub routine_id: i64,
    pub step_order: i64,
    pub stage_type: String,
    pub duration_ms: i64,
    pub config_json: String,
}

/// Readiness Score 행 — 매일 2분 마이크로 테스트 결과
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadinessScoreRow {
    pub id: i64,
    pub profile_id: i64,
    pub score: f64,
    pub baseline_delta: String,
    pub daily_advice: Option<String>,
    pub measured_at: String,
}

/// 스타일 전환 행 — 에임 스타일 전환 추적
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StyleTransitionRow {
    pub id: i64,
    pub profile_id: i64,
    pub from_type: String,
    pub to_type: String,
    pub target_sens_range: String,
    pub started_at: String,
    pub current_phase: String,
    pub plateau_detected: bool,
    pub completed_at: Option<String>,
}

const SCHEMA_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS hardware_combos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mouse_model TEXT NOT NULL,
    dpi INTEGER NOT NULL,
    verified_dpi INTEGER,
    polling_rate INTEGER,
    mousepad_model TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    engine TEXT,
    fov_type TEXT NOT NULL DEFAULT 'horizontal',
    fov_default REAL NOT NULL,
    fov_config_to_hfov_formula TEXT,
    yaw_formula TEXT NOT NULL,
    sens_step REAL,
    movement_ratio REAL NOT NULL DEFAULT 0.3
);

CREATE TABLE IF NOT EXISTS zoom_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL REFERENCES games(id),
    scope_name TEXT NOT NULL,
    zoom_ratio REAL NOT NULL,
    fov_override REAL,
    steady_weight REAL NOT NULL DEFAULT 0.5,
    transition_weight REAL NOT NULL DEFAULT 0.3,
    zoomout_weight REAL NOT NULL DEFAULT 0.2
);

CREATE TABLE IF NOT EXISTS recoil_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL REFERENCES games(id),
    weapon_name TEXT NOT NULL,
    pattern_points TEXT NOT NULL,
    randomness REAL NOT NULL DEFAULT 0.0,
    vertical REAL NOT NULL DEFAULT 1.0,
    horizontal REAL NOT NULL DEFAULT 0.0,
    rpm INTEGER NOT NULL DEFAULT 600,
    is_custom INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS movement_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL REFERENCES games(id),
    name TEXT NOT NULL,
    max_speed REAL NOT NULL,
    stop_time REAL NOT NULL,
    accel_type TEXT NOT NULL DEFAULT 'linear',
    air_control REAL NOT NULL DEFAULT 0.0,
    cs_bonus REAL NOT NULL DEFAULT 0.0,
    is_custom INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hardware_combo_id INTEGER REFERENCES hardware_combos(id),
    game_id INTEGER NOT NULL REFERENCES games(id),
    current_sens REAL NOT NULL,
    current_cm360 REAL NOT NULL,
    optimal_cm360 REAL,
    calibration_mode TEXT NOT NULL DEFAULT 'explore',
    fov_setting REAL,
    is_reference_game INTEGER NOT NULL DEFAULT 0,
    deep_mode_enabled INTEGER NOT NULL DEFAULT 0,
    obsessive_mode_enabled INTEGER NOT NULL DEFAULT 0,
    k_value REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id),
    mode TEXT NOT NULL,
    session_type TEXT NOT NULL,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at TEXT,
    total_trials INTEGER NOT NULL DEFAULT 0,
    avg_fps REAL,
    monitor_refresh INTEGER
);

CREATE TABLE IF NOT EXISTS trials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES sessions(id),
    scenario_type TEXT NOT NULL,
    cm360_tested REAL NOT NULL,
    zoom_scope_id INTEGER REFERENCES zoom_profiles(id),
    fov_at_test REAL,
    movement_profile_id INTEGER REFERENCES movement_profiles(id),
    composite_score REAL NOT NULL,
    raw_metrics TEXT NOT NULL DEFAULT '{}',
    mouse_trajectory TEXT NOT NULL DEFAULT '[]',
    click_events TEXT NOT NULL DEFAULT '[]',
    angle_breakdown TEXT NOT NULL DEFAULT '{}',
    motor_breakdown TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS zoom_calibrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id),
    zoom_profile_id INTEGER NOT NULL REFERENCES zoom_profiles(id),
    optimal_multiplier REAL NOT NULL,
    steady_score REAL,
    correction_score REAL,
    zoomout_score REAL,
    composite_score REAL NOT NULL,
    conversion_method TEXT,
    mdm_predicted REAL,
    actual_optimal REAL,
    deviation REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS multiplier_curves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id),
    k_value REAL NOT NULL,
    k_variance REAL,
    data_points TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversion_comparisons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id),
    zoom_profile_id INTEGER NOT NULL REFERENCES zoom_profiles(id),
    method TEXT NOT NULL,
    multiplier_used REAL NOT NULL,
    steady_score REAL,
    correction_score REAL,
    zoomout_score REAL,
    composite_score REAL NOT NULL,
    p_value REAL,
    effect_size REAL,
    trial_order INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS performance_landscapes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id),
    calibration_session_id INTEGER REFERENCES calibration_sessions(id),
    gp_mean_curve TEXT NOT NULL DEFAULT '[]',
    confidence_bands TEXT NOT NULL DEFAULT '[]',
    scenario_overlays TEXT NOT NULL DEFAULT '{}',
    bimodal_peaks TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS aim_dna (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id),
    session_id INTEGER REFERENCES sessions(id),
    flick_peak_velocity REAL,
    overshoot_avg REAL,
    direction_bias REAL,
    effective_range REAL,
    tracking_mad REAL,
    phase_lag REAL,
    smoothness REAL,
    velocity_match REAL,
    micro_freq REAL,
    wrist_arm_ratio REAL,
    fitts_a REAL,
    fitts_b REAL,
    fatigue_decay REAL,
    pre_aim_ratio REAL,
    pre_fire_ratio REAL,
    sens_attributed_overshoot REAL,
    v_h_ratio REAL,
    finger_accuracy REAL,
    wrist_accuracy REAL,
    arm_accuracy REAL,
    motor_transition_angle REAL,
    adaptation_rate REAL,
    type_label TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS aim_dna_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id),
    feature_name TEXT NOT NULL,
    value REAL NOT NULL,
    measured_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS training_prescriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    aim_dna_id INTEGER NOT NULL REFERENCES aim_dna(id),
    source_type TEXT NOT NULL,
    weakness TEXT NOT NULL,
    scenario_type TEXT NOT NULL,
    scenario_params TEXT NOT NULL DEFAULT '{}',
    priority REAL NOT NULL DEFAULT 0.0,
    estimated_min REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS crossgame_comparisons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_a_id INTEGER NOT NULL REFERENCES profiles(id),
    profile_b_id INTEGER NOT NULL REFERENCES profiles(id),
    reference_game_id INTEGER NOT NULL REFERENCES games(id),
    deltas TEXT NOT NULL DEFAULT '{}',
    causes TEXT NOT NULL DEFAULT '[]',
    plan TEXT NOT NULL DEFAULT '{}',
    predicted_days REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS crossgame_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comparison_id INTEGER NOT NULL REFERENCES crossgame_comparisons(id),
    week_number INTEGER NOT NULL,
    metrics TEXT NOT NULL DEFAULT '{}',
    gap_reduction_pct REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS style_transitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id),
    from_type TEXT NOT NULL,
    to_type TEXT NOT NULL,
    target_sens_range TEXT NOT NULL,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    current_phase TEXT NOT NULL DEFAULT 'initial',
    plateau_detected INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT
);

CREATE TABLE IF NOT EXISTS readiness_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id),
    score REAL NOT NULL,
    baseline_delta TEXT NOT NULL DEFAULT '{}',
    daily_advice TEXT,
    measured_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS fov_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id),
    fov_tested REAL NOT NULL,
    scenario_type TEXT NOT NULL,
    score REAL NOT NULL,
    peripheral_score REAL,
    center_score REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cross_game_pairs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_a INTEGER NOT NULL REFERENCES games(id),
    cm360_a REAL NOT NULL,
    game_b INTEGER NOT NULL REFERENCES games(id),
    cm360_b REAL NOT NULL,
    delta_physics TEXT NOT NULL DEFAULT '{}',
    aim_dna_cluster TEXT,
    hardware_category TEXT,
    mdm_predicted REAL,
    actual_deviation REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS population_export (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    aim_dna_features TEXT NOT NULL DEFAULT '{}',
    game_id INTEGER REFERENCES games(id),
    optimal_cm360 REAL,
    k_value REAL,
    conversion_scores TEXT NOT NULL DEFAULT '{}',
    movement_ratio REAL,
    fov REAL,
    hardware_category TEXT,
    skill_proxy REAL,
    exported_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS game_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id),
    rating INTEGER NOT NULL,
    status TEXT NOT NULL,
    adjusted_by REAL,
    feedback_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 캘리브레이션 세션 메타데이터
CREATE TABLE IF NOT EXISTS calibration_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id),
    mode TEXT NOT NULL,
    stage TEXT NOT NULL DEFAULT 'screening',
    current_cm360 REAL NOT NULL,
    game_category TEXT NOT NULL,
    is_complete INTEGER NOT NULL DEFAULT 0,
    bimodal_detected INTEGER NOT NULL DEFAULT 0,
    primary_peak REAL,
    secondary_peak REAL,
    final_recommendation REAL,
    significance_p REAL,
    significance_label TEXT,
    total_iterations INTEGER NOT NULL DEFAULT 0,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at TEXT
);

-- GP 모델 하이퍼파라미터 스냅샷
CREATE TABLE IF NOT EXISTS gp_models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    calibration_session_id INTEGER NOT NULL REFERENCES calibration_sessions(id),
    length_scale REAL NOT NULL DEFAULT 5.0,
    signal_var REAL NOT NULL DEFAULT 0.1,
    noise_var REAL NOT NULL DEFAULT 0.015,
    prior_mean REAL,
    prior_var REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- GP 관측 데이터 (X=cm360, Y=score)
CREATE TABLE IF NOT EXISTS gp_observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gp_model_id INTEGER NOT NULL REFERENCES gp_models(id),
    cm360_input REAL NOT NULL,
    score_output REAL NOT NULL,
    trial_id INTEGER REFERENCES trials(id),
    iteration INTEGER NOT NULL,
    ei_value REAL,
    gp_mean REAL,
    gp_variance REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- DNA 스크리닝 결과 (Stage 1)
CREATE TABLE IF NOT EXISTS partial_aim_dna (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    calibration_session_id INTEGER NOT NULL REFERENCES calibration_sessions(id),
    wrist_arm_ratio REAL,
    avg_overshoot REAL,
    pre_aim_ratio REAL,
    direction_bias REAL,
    tracking_smoothness REAL,
    adaptation_rate REAL,
    warmup_trials INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 훈련 스테이지 결과
CREATE TABLE IF NOT EXISTS stage_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id),
    stage_type TEXT NOT NULL,
    category TEXT NOT NULL,
    score REAL NOT NULL,
    accuracy REAL NOT NULL,
    avg_ttk_ms REAL NOT NULL,
    avg_reaction_ms REAL NOT NULL,
    avg_overshoot_deg REAL NOT NULL DEFAULT 0.0,
    avg_undershoot_deg REAL NOT NULL DEFAULT 0.0,
    tracking_mad REAL,
    raw_metrics TEXT NOT NULL DEFAULT '{}',
    difficulty_config TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ═══════════════════════════════════════════════════
-- Phase 5: 신규 테이블 (Day 18+)
-- ═══════════════════════════════════════════════════

-- 크래시 로그 (로컬 저장 + 서버 전송 옵트인)
CREATE TABLE IF NOT EXISTS crash_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    error_type TEXT NOT NULL,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    context TEXT NOT NULL DEFAULT '{}',
    app_version TEXT NOT NULL DEFAULT '0.1.0',
    sent_to_server INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 일별 통계 집계 (대시보드 빠른 조회용)
CREATE TABLE IF NOT EXISTS daily_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id),
    stat_date TEXT NOT NULL,
    scenario_type TEXT NOT NULL,
    avg_score REAL NOT NULL DEFAULT 0.0,
    max_score REAL NOT NULL DEFAULT 0.0,
    sessions_count INTEGER NOT NULL DEFAULT 0,
    total_trials INTEGER NOT NULL DEFAULT 0,
    total_time_ms INTEGER NOT NULL DEFAULT 0,
    avg_accuracy REAL NOT NULL DEFAULT 0.0,
    UNIQUE(profile_id, stat_date, scenario_type)
);
CREATE INDEX IF NOT EXISTS idx_daily_stats_profile_date ON daily_stats(profile_id, stat_date);

-- 스킬 진행도 (스테이지별 롤링 통계)
CREATE TABLE IF NOT EXISTS skill_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id),
    stage_type TEXT NOT NULL,
    rolling_avg_score REAL NOT NULL DEFAULT 0.0,
    best_score REAL NOT NULL DEFAULT 0.0,
    total_sessions INTEGER NOT NULL DEFAULT 0,
    total_time_ms INTEGER NOT NULL DEFAULT 0,
    last_updated TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(profile_id, stage_type)
);

-- 범용 사용자 설정 (디스플레이, 퍼포먼스 등)
CREATE TABLE IF NOT EXISTS user_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id),
    setting_key TEXT NOT NULL,
    setting_value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(profile_id, setting_key)
);

-- 유저별 게임 프로필 (감도/DPI/FOV/키바인드)
CREATE TABLE IF NOT EXISTS user_game_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id),
    game_id TEXT NOT NULL,
    game_name TEXT NOT NULL,
    custom_sens REAL NOT NULL,
    custom_dpi INTEGER NOT NULL,
    custom_fov REAL NOT NULL,
    custom_cm360 REAL NOT NULL,
    keybinds_json TEXT NOT NULL DEFAULT '{}',
    is_active INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 커스텀 루틴 (시나리오 순서대로 묶기)
CREATE TABLE IF NOT EXISTS routines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id),
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    total_duration_ms INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 루틴 개별 스텝
CREATE TABLE IF NOT EXISTS routine_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    routine_id INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    stage_type TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    config_json TEXT NOT NULL DEFAULT '{}',
    UNIQUE(routine_id, step_order)
);

-- DNA 시계열 스냅샷 — 매 DNA 측정마다 5축 점수 저장
CREATE TABLE IF NOT EXISTS aim_dna_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id),
    aim_dna_id INTEGER NOT NULL REFERENCES aim_dna(id),
    -- 5축 레이더 점수 (0~100 정규화)
    flick_power REAL NOT NULL DEFAULT 0,
    tracking_precision REAL NOT NULL DEFAULT 0,
    motor_control REAL NOT NULL DEFAULT 0,
    speed REAL NOT NULL DEFAULT 0,
    consistency REAL NOT NULL DEFAULT 0,
    -- 측정 당시 컨텍스트
    type_label TEXT,
    cm360_sensitivity REAL,
    measured_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- DNA 타임라인 변경점 이벤트 — 기어/감도/그립/자세 변경 마킹
CREATE TABLE IF NOT EXISTS aim_dna_change_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id),
    change_type TEXT NOT NULL, -- 'gear' | 'sensitivity' | 'grip' | 'posture'
    before_value TEXT,         -- 변경 전 값 (JSON 문자열)
    after_value TEXT NOT NULL, -- 변경 후 값 (JSON 문자열)
    description TEXT NOT NULL DEFAULT '',
    occurred_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 빠른 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_stage_results_profile_type ON stage_results(profile_id, stage_type, created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_profile_started ON sessions(profile_id, started_at);
CREATE INDEX IF NOT EXISTS idx_trials_session ON trials(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_dna_snapshots_profile ON aim_dna_snapshots(profile_id, measured_at);
CREATE INDEX IF NOT EXISTS idx_change_events_profile ON aim_dna_change_events(profile_id, occurred_at);
"#;
