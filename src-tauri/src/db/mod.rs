use rusqlite::{Connection, Result};
use std::path::Path;

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
        Ok(())
    }

    pub fn conn(&self) -> &Connection {
        &self.conn
    }
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
"#;
