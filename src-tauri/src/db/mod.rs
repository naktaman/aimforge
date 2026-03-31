pub mod commands;

use rusqlite::{Connection, Result};
use serde::Serialize;
use std::path::Path;

/// 줌 프로파일 DB 행
#[derive(Debug, Clone, Serialize)]
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
        Ok(())
    }

    pub fn conn(&self) -> &Connection {
        &self.conn
    }

    /// 새 세션 생성 — 세션 ID 반환
    pub fn insert_session(
        &self,
        profile_id: i64,
        mode: &str,
        session_type: &str,
    ) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO sessions (profile_id, mode, session_type, started_at) VALUES (?1, ?2, ?3, datetime('now'))",
            rusqlite::params![profile_id, mode, session_type],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    /// 트라이얼 저장 — 트라이얼 ID 반환
    pub fn insert_trial(
        &self,
        session_id: i64,
        scenario_type: &str,
        cm360_tested: f64,
        composite_score: f64,
        raw_metrics: &str,
        mouse_trajectory: &str,
        click_events: &str,
        angle_breakdown: &str,
        motor_breakdown: &str,
    ) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO trials (session_id, scenario_type, cm360_tested, composite_score, raw_metrics, mouse_trajectory, click_events, angle_breakdown, motor_breakdown) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            rusqlite::params![
                session_id, scenario_type, cm360_tested, composite_score,
                raw_metrics, mouse_trajectory, click_events, angle_breakdown, motor_breakdown
            ],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    // ── 캘리브레이션 CRUD ──

    /// 캘리브레이션 세션 생성 — 세션 ID 반환
    pub fn insert_calibration_session(
        &self,
        profile_id: i64,
        mode: &str,
        current_cm360: f64,
        game_category: &str,
    ) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO calibration_sessions (profile_id, mode, current_cm360, game_category) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![profile_id, mode, current_cm360, game_category],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    /// 캘리브레이션 결과 업데이트
    pub fn update_calibration_result(
        &self,
        session_id: i64,
        final_recommendation: f64,
        bimodal_detected: bool,
        primary_peak: Option<f64>,
        secondary_peak: Option<f64>,
        significance_p: f64,
        significance_label: &str,
        total_iterations: i64,
    ) -> Result<()> {
        self.conn.execute(
            "UPDATE calibration_sessions SET is_complete = 1, ended_at = datetime('now'), \
             final_recommendation = ?2, bimodal_detected = ?3, primary_peak = ?4, \
             secondary_peak = ?5, significance_p = ?6, significance_label = ?7, \
             total_iterations = ?8 WHERE id = ?1",
            rusqlite::params![
                session_id,
                final_recommendation,
                bimodal_detected as i32,
                primary_peak,
                secondary_peak,
                significance_p,
                significance_label,
                total_iterations
            ],
        )?;
        Ok(())
    }

    /// GP 모델 생성 — 모델 ID 반환
    pub fn insert_gp_model(
        &self,
        calibration_session_id: i64,
        length_scale: f64,
        signal_var: f64,
        noise_var: f64,
        prior_mean: Option<f64>,
        prior_var: Option<f64>,
    ) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO gp_models (calibration_session_id, length_scale, signal_var, noise_var, prior_mean, prior_var) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![calibration_session_id, length_scale, signal_var, noise_var, prior_mean, prior_var],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    /// GP 관측 데이터 저장
    pub fn insert_gp_observation(
        &self,
        gp_model_id: i64,
        cm360_input: f64,
        score_output: f64,
        trial_id: Option<i64>,
        iteration: i64,
        ei_value: Option<f64>,
        gp_mean: Option<f64>,
        gp_variance: Option<f64>,
    ) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO gp_observations (gp_model_id, cm360_input, score_output, trial_id, iteration, ei_value, gp_mean, gp_variance) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![gp_model_id, cm360_input, score_output, trial_id, iteration, ei_value, gp_mean, gp_variance],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    /// 부분 Aim DNA 저장
    pub fn insert_partial_aim_dna(
        &self,
        calibration_session_id: i64,
        wrist_arm_ratio: Option<f64>,
        avg_overshoot: Option<f64>,
        pre_aim_ratio: Option<f64>,
        direction_bias: Option<f64>,
        tracking_smoothness: Option<f64>,
        adaptation_rate: Option<f64>,
        warmup_trials: Option<i64>,
    ) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO partial_aim_dna (calibration_session_id, wrist_arm_ratio, avg_overshoot, \
             pre_aim_ratio, direction_bias, tracking_smoothness, adaptation_rate, warmup_trials) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![
                calibration_session_id,
                wrist_arm_ratio,
                avg_overshoot,
                pre_aim_ratio,
                direction_bias,
                tracking_smoothness,
                adaptation_rate,
                warmup_trials
            ],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    // ── 줌 캘리브레이션 CRUD ──

    /// 줌 캘리브레이션 결과 저장 — ID 반환
    pub fn insert_zoom_calibration(
        &self,
        profile_id: i64,
        zoom_profile_id: i64,
        optimal_multiplier: f64,
        steady_score: Option<f64>,
        correction_score: Option<f64>,
        zoomout_score: Option<f64>,
        composite_score: f64,
        conversion_method: Option<&str>,
        mdm_predicted: Option<f64>,
        actual_optimal: Option<f64>,
        deviation: Option<f64>,
    ) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO zoom_calibrations (profile_id, zoom_profile_id, optimal_multiplier, \
             steady_score, correction_score, zoomout_score, composite_score, \
             conversion_method, mdm_predicted, actual_optimal, deviation) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            rusqlite::params![
                profile_id, zoom_profile_id, optimal_multiplier,
                steady_score, correction_score, zoomout_score, composite_score,
                conversion_method, mdm_predicted, actual_optimal, deviation
            ],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    /// 배율 곡선 (k 피팅 결과) 저장 — ID 반환
    pub fn insert_multiplier_curve(
        &self,
        profile_id: i64,
        k_value: f64,
        k_variance: Option<f64>,
        data_points: &str,
    ) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO multiplier_curves (profile_id, k_value, k_variance, data_points) \
             VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![profile_id, k_value, k_variance, data_points],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    /// 변환 방식 비교 트라이얼 저장 — ID 반환
    pub fn insert_conversion_comparison(
        &self,
        profile_id: i64,
        zoom_profile_id: i64,
        method: &str,
        multiplier_used: f64,
        steady_score: Option<f64>,
        correction_score: Option<f64>,
        zoomout_score: Option<f64>,
        composite_score: f64,
        p_value: Option<f64>,
        effect_size: Option<f64>,
        trial_order: Option<i64>,
    ) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO conversion_comparisons (profile_id, zoom_profile_id, method, \
             multiplier_used, steady_score, correction_score, zoomout_score, \
             composite_score, p_value, effect_size, trial_order) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            rusqlite::params![
                profile_id, zoom_profile_id, method, multiplier_used,
                steady_score, correction_score, zoomout_score,
                composite_score, p_value, effect_size, trial_order
            ],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    /// Performance Landscape 저장 — ID 반환
    pub fn insert_performance_landscape(
        &self,
        profile_id: i64,
        calibration_session_id: Option<i64>,
        gp_mean_curve: &str,
        confidence_bands: &str,
        scenario_overlays: &str,
        bimodal_peaks: &str,
    ) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO performance_landscapes (profile_id, calibration_session_id, \
             gp_mean_curve, confidence_bands, scenario_overlays, bimodal_peaks) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                profile_id, calibration_session_id,
                gp_mean_curve, confidence_bands, scenario_overlays, bimodal_peaks
            ],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    /// 게임의 줌 프로파일 목록 조회
    pub fn get_zoom_profiles(&self, game_id: i64) -> Result<Vec<ZoomProfileRow>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, game_id, scope_name, zoom_ratio, fov_override, \
             steady_weight, transition_weight, zoomout_weight \
             FROM zoom_profiles WHERE game_id = ?1 ORDER BY zoom_ratio"
        )?;
        let rows = stmt.query_map(rusqlite::params![game_id], |row| {
            Ok(ZoomProfileRow {
                id: row.get(0)?,
                game_id: row.get(1)?,
                scope_name: row.get(2)?,
                zoom_ratio: row.get(3)?,
                fov_override: row.get(4)?,
                steady_weight: row.get(5)?,
                transition_weight: row.get(6)?,
                zoomout_weight: row.get(7)?,
            })
        })?;
        rows.collect()
    }

    /// 프로파일 k_value 업데이트
    pub fn update_profile_k_value(&self, profile_id: i64, k_value: f64) -> Result<()> {
        self.conn.execute(
            "UPDATE profiles SET k_value = ?2, updated_at = datetime('now') WHERE id = ?1",
            rusqlite::params![profile_id, k_value],
        )?;
        Ok(())
    }

    /// 세션 종료 업데이트 (FPS 통계 포함)
    pub fn update_session_end(
        &self,
        session_id: i64,
        total_trials: i64,
        avg_fps: f64,
        monitor_refresh: i64,
    ) -> Result<()> {
        self.conn.execute(
            "UPDATE sessions SET ended_at = datetime('now'), total_trials = ?2, avg_fps = ?3, monitor_refresh = ?4 WHERE id = ?1",
            rusqlite::params![session_id, total_trials, avg_fps, monitor_refresh],
        )?;
        Ok(())
    }

    // ── Aim DNA CRUD ──

    /// Aim DNA 프로파일 저장 — ID 반환
    pub fn insert_aim_dna(&self, dna: &crate::aim_dna::AimDnaProfile) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO aim_dna (profile_id, session_id, flick_peak_velocity, overshoot_avg, \
             direction_bias, effective_range, tracking_mad, phase_lag, smoothness, velocity_match, \
             micro_freq, wrist_arm_ratio, fitts_a, fitts_b, fatigue_decay, pre_aim_ratio, \
             pre_fire_ratio, sens_attributed_overshoot, v_h_ratio, finger_accuracy, wrist_accuracy, \
             arm_accuracy, motor_transition_angle, adaptation_rate, type_label) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, \
             ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25)",
            rusqlite::params![
                dna.profile_id, dna.session_id,
                dna.flick_peak_velocity, dna.overshoot_avg,
                dna.direction_bias, dna.effective_range,
                dna.tracking_mad, dna.phase_lag, dna.smoothness, dna.velocity_match,
                dna.micro_freq, dna.wrist_arm_ratio, dna.fitts_a, dna.fitts_b,
                dna.fatigue_decay, dna.pre_aim_ratio, dna.pre_fire_ratio,
                dna.sens_attributed_overshoot, dna.v_h_ratio,
                dna.finger_accuracy, dna.wrist_accuracy, dna.arm_accuracy,
                dna.motor_transition_angle, dna.adaptation_rate, dna.type_label
            ],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    /// Aim DNA 히스토리 일괄 저장
    pub fn insert_aim_dna_history_batch(
        &self,
        profile_id: i64,
        features: &[(String, f64)],
    ) -> Result<()> {
        let mut stmt = self.conn.prepare(
            "INSERT INTO aim_dna_history (profile_id, feature_name, value) VALUES (?1, ?2, ?3)"
        )?;
        for (name, value) in features {
            stmt.execute(rusqlite::params![profile_id, name, value])?;
        }
        Ok(())
    }

    /// 최신 Aim DNA 프로파일 조회
    pub fn get_latest_aim_dna(&self, profile_id: i64) -> Result<Option<crate::aim_dna::AimDnaProfile>> {
        let mut stmt = self.conn.prepare(
            "SELECT profile_id, session_id, flick_peak_velocity, overshoot_avg, direction_bias, \
             effective_range, tracking_mad, phase_lag, smoothness, velocity_match, micro_freq, \
             wrist_arm_ratio, fitts_a, fitts_b, fatigue_decay, pre_aim_ratio, pre_fire_ratio, \
             sens_attributed_overshoot, v_h_ratio, finger_accuracy, wrist_accuracy, arm_accuracy, \
             motor_transition_angle, adaptation_rate, type_label \
             FROM aim_dna WHERE profile_id = ?1 ORDER BY created_at DESC LIMIT 1"
        )?;
        let mut rows = stmt.query_map(rusqlite::params![profile_id], |row| {
            Ok(crate::aim_dna::AimDnaProfile {
                profile_id: row.get(0)?,
                session_id: row.get(1)?,
                flick_peak_velocity: row.get(2)?,
                overshoot_avg: row.get(3)?,
                direction_bias: row.get(4)?,
                effective_range: row.get(5)?,
                tracking_mad: row.get(6)?,
                phase_lag: row.get(7)?,
                smoothness: row.get(8)?,
                velocity_match: row.get(9)?,
                micro_freq: row.get(10)?,
                wrist_arm_ratio: row.get(11)?,
                fitts_a: row.get(12)?,
                fitts_b: row.get(13)?,
                fatigue_decay: row.get(14)?,
                pre_aim_ratio: row.get(15)?,
                pre_fire_ratio: row.get(16)?,
                sens_attributed_overshoot: row.get(17)?,
                v_h_ratio: row.get(18)?,
                finger_accuracy: row.get(19)?,
                wrist_accuracy: row.get(20)?,
                arm_accuracy: row.get(21)?,
                motor_transition_angle: row.get(22)?,
                adaptation_rate: row.get(23)?,
                type_label: row.get(24)?,
            })
        })?;
        match rows.next() {
            Some(Ok(dna)) => Ok(Some(dna)),
            Some(Err(e)) => Err(e),
            None => Ok(None),
        }
    }

    /// Aim DNA 히스토리 조회 (옵션: 특정 피처 필터)
    pub fn get_aim_dna_history(
        &self,
        profile_id: i64,
        feature_name: Option<&str>,
    ) -> Result<Vec<crate::aim_dna::commands::AimDnaHistoryEntry>> {
        let (sql, params_vec): (String, Vec<Box<dyn rusqlite::types::ToSql>>) = match feature_name {
            Some(f) => (
                "SELECT feature_name, value, measured_at FROM aim_dna_history \
                 WHERE profile_id = ?1 AND feature_name = ?2 ORDER BY measured_at DESC".to_string(),
                vec![Box::new(profile_id) as Box<dyn rusqlite::types::ToSql>, Box::new(f.to_string())],
            ),
            None => (
                "SELECT feature_name, value, measured_at FROM aim_dna_history \
                 WHERE profile_id = ?1 ORDER BY measured_at DESC LIMIT 200".to_string(),
                vec![Box::new(profile_id) as Box<dyn rusqlite::types::ToSql>],
            ),
        };
        let mut stmt = self.conn.prepare(&sql)?;
        let params_refs: Vec<&dyn rusqlite::types::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
        let rows = stmt.query_map(params_refs.as_slice(), |row| {
            Ok(crate::aim_dna::commands::AimDnaHistoryEntry {
                feature_name: row.get(0)?,
                value: row.get(1)?,
                measured_at: row.get(2)?,
            })
        })?;
        rows.collect()
    }

    // ── 세션 히스토리 CRUD ──

    /// 세션 목록 조회 (최근 N개)
    pub fn get_sessions_list(
        &self,
        profile_id: i64,
        limit: i64,
    ) -> Result<Vec<crate::aim_dna::commands::SessionSummary>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, mode, session_type, started_at, ended_at, total_trials, avg_fps \
             FROM sessions WHERE profile_id = ?1 ORDER BY started_at DESC LIMIT ?2"
        )?;
        let rows = stmt.query_map(rusqlite::params![profile_id, limit], |row| {
            Ok(crate::aim_dna::commands::SessionSummary {
                id: row.get(0)?,
                mode: row.get(1)?,
                session_type: row.get(2)?,
                started_at: row.get(3)?,
                ended_at: row.get(4)?,
                total_trials: row.get(5)?,
                avg_fps: row.get(6)?,
            })
        })?;
        rows.collect()
    }

    /// 세션 상세 조회 (트라이얼 포함)
    pub fn get_session_detail(
        &self,
        session_id: i64,
    ) -> Result<crate::aim_dna::commands::SessionDetail> {
        // 세션 기본 정보
        let session = self.conn.query_row(
            "SELECT id, mode, session_type, started_at, ended_at, total_trials, avg_fps \
             FROM sessions WHERE id = ?1",
            rusqlite::params![session_id],
            |row| {
                Ok(crate::aim_dna::commands::SessionSummary {
                    id: row.get(0)?,
                    mode: row.get(1)?,
                    session_type: row.get(2)?,
                    started_at: row.get(3)?,
                    ended_at: row.get(4)?,
                    total_trials: row.get(5)?,
                    avg_fps: row.get(6)?,
                })
            },
        )?;

        // 트라이얼 목록
        let mut stmt = self.conn.prepare(
            "SELECT id, scenario_type, cm360_tested, composite_score, created_at \
             FROM trials WHERE session_id = ?1 ORDER BY created_at"
        )?;
        let trials = stmt.query_map(rusqlite::params![session_id], |row| {
            Ok(crate::aim_dna::commands::TrialSummary {
                id: row.get(0)?,
                scenario_type: row.get(1)?,
                cm360_tested: row.get(2)?,
                composite_score: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?.collect::<Result<Vec<_>>>()?;

        Ok(crate::aim_dna::commands::SessionDetail { session, trials })
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
"#;
