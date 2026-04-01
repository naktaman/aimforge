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
                data_sufficiency: std::collections::HashMap::new(),
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

    // ── 레퍼런스 게임 + 크로스게임 헬퍼 ──

    /// 레퍼런스 게임 설정 — 기존 해제 후 새 프로파일에 설정
    pub fn set_reference_game(&self, profile_id: i64) -> Result<()> {
        self.conn.execute(
            "UPDATE profiles SET is_reference_game = 0 WHERE is_reference_game = 1",
            [],
        )?;
        self.conn.execute(
            "UPDATE profiles SET is_reference_game = 1 WHERE id = ?1",
            rusqlite::params![profile_id],
        )?;
        Ok(())
    }

    /// 레퍼런스 게임 프로파일 ID 조회
    pub fn get_reference_game_profile_id(&self) -> Result<Option<i64>> {
        let mut stmt = self.conn.prepare(
            "SELECT id FROM profiles WHERE is_reference_game = 1 LIMIT 1"
        )?;
        let mut rows = stmt.query_map([], |row| row.get::<_, i64>(0))?;
        match rows.next() {
            Some(Ok(id)) => Ok(Some(id)),
            Some(Err(e)) => Err(e),
            None => Ok(None),
        }
    }

    /// 모든 프로파일의 최신 DNA 일괄 조회 (레퍼런스 감지용)
    pub fn get_all_profiles_latest_dna(&self) -> Result<Vec<(i64, crate::aim_dna::AimDnaProfile)>> {
        // aim_dna 테이블에서 distinct profile_id 조회
        let mut stmt = self.conn.prepare(
            "SELECT DISTINCT profile_id FROM aim_dna"
        )?;
        let pids: Vec<i64> = stmt.query_map([], |row| row.get(0))?
            .filter_map(|r| r.ok())
            .collect();

        let mut results = Vec::new();
        for pid in pids {
            if let Ok(Some(dna)) = self.get_latest_aim_dna(pid) {
                results.push((pid, dna));
            }
        }
        Ok(results)
    }

    /// 프로파일의 현재 cm/360 조회
    pub fn get_profile_cm360(&self, profile_id: i64) -> Result<Option<f64>> {
        let mut stmt = self.conn.prepare(
            "SELECT current_cm360 FROM profiles WHERE id = ?1"
        )?;
        let mut rows = stmt.query_map(rusqlite::params![profile_id], |row| row.get::<_, Option<f64>>(0))?;
        match rows.next() {
            Some(Ok(val)) => Ok(val),
            Some(Err(e)) => Err(e),
            None => Ok(None),
        }
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

    /// 트라이얼의 궤적+클릭 JSON 로드 (궤적 분석용)
    pub fn get_trial_trajectory_data(
        &self,
        trial_id: i64,
    ) -> Result<(String, String, f64)> {
        self.conn.query_row(
            "SELECT mouse_trajectory, click_events, cm360_tested FROM trials WHERE id = ?1",
            rusqlite::params![trial_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
    }

    // ── Training 처방 CRUD ──

    /// 훈련 처방 저장 — ID 반환
    pub fn insert_training_prescription(
        &self,
        aim_dna_id: i64,
        source_type: &str,
        weakness: &str,
        scenario_type: &str,
        scenario_params: &str,
        priority: f64,
        estimated_min: Option<f64>,
    ) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO training_prescriptions (aim_dna_id, source_type, weakness, scenario_type, \
             scenario_params, priority, estimated_min) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![aim_dna_id, source_type, weakness, scenario_type, scenario_params, priority, estimated_min],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    /// 최신 aim_dna ID 조회
    pub fn get_latest_aim_dna_id(&self, profile_id: i64) -> Result<Option<i64>> {
        let mut stmt = self.conn.prepare(
            "SELECT id FROM aim_dna WHERE profile_id = ?1 ORDER BY created_at DESC LIMIT 1"
        )?;
        let mut rows = stmt.query_map(rusqlite::params![profile_id], |row| row.get(0))?;
        match rows.next() {
            Some(Ok(id)) => Ok(Some(id)),
            Some(Err(e)) => Err(e),
            None => Ok(None),
        }
    }

    // ── Cross-game CRUD ──

    /// 크로스게임 비교 결과 저장 — ID 반환
    pub fn insert_crossgame_comparison(
        &self,
        profile_a_id: i64,
        profile_b_id: i64,
        reference_game_id: i64,
        deltas: &str,
        causes: &str,
        plan: &str,
        predicted_days: f64,
    ) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO crossgame_comparisons (profile_a_id, profile_b_id, reference_game_id, \
             deltas, causes, plan, predicted_days) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![profile_a_id, profile_b_id, reference_game_id, deltas, causes, plan, predicted_days],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    /// 크로스게임 진행 기록 저장 — ID 반환
    pub fn insert_crossgame_progress(
        &self,
        comparison_id: i64,
        week_number: i64,
        metrics: &str,
        gap_reduction_pct: f64,
    ) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO crossgame_progress (comparison_id, week_number, metrics, gap_reduction_pct) \
             VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![comparison_id, week_number, metrics, gap_reduction_pct],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    /// 크로스게임 비교 히스토리 조회 (프로파일 관련)
    pub fn get_crossgame_history(
        &self,
        profile_id: i64,
        limit: i64,
    ) -> Result<Vec<crate::crossgame::commands::CrossGameComparisonSummary>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, profile_a_id, profile_b_id, \
             CAST(COALESCE( \
               (SELECT AVG(ABS(json_each.value)) FROM json_each(deltas, '$') AS json_each \
                WHERE json_extract(json_each.value, '$.delta_pct') IS NOT NULL), 0) AS REAL) as overall_gap, \
             predicted_days, created_at \
             FROM crossgame_comparisons \
             WHERE profile_a_id = ?1 OR profile_b_id = ?1 \
             ORDER BY created_at DESC LIMIT ?2"
        ).or_else(|_| {
            // JSON 함수 미지원 시 fallback (overall_gap = predicted_days 기반 추정)
            self.conn.prepare(
                "SELECT id, profile_a_id, profile_b_id, predicted_days, predicted_days, created_at \
                 FROM crossgame_comparisons \
                 WHERE profile_a_id = ?1 OR profile_b_id = ?1 \
                 ORDER BY created_at DESC LIMIT ?2"
            )
        })?;
        let rows = stmt.query_map(rusqlite::params![profile_id, limit], |row| {
            Ok(crate::crossgame::commands::CrossGameComparisonSummary {
                id: row.get(0)?,
                profile_a_id: row.get(1)?,
                profile_b_id: row.get(2)?,
                overall_gap: row.get(3)?,
                predicted_days: row.get(4)?,
                created_at: row.get(5)?,
            })
        })?;
        rows.collect()
    }

    // ── Training Stage 결과 CRUD ──

    /// 스테이지 결과 저장 — ID 반환
    pub fn insert_stage_result(
        &self,
        profile_id: i64,
        stage_type: &str,
        category: &str,
        score: f64,
        accuracy: f64,
        avg_ttk_ms: f64,
        avg_reaction_ms: f64,
        avg_overshoot_deg: f64,
        avg_undershoot_deg: f64,
        tracking_mad: Option<f64>,
        raw_metrics: &str,
        difficulty_config: &str,
    ) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO stage_results (profile_id, stage_type, category, score, accuracy, \
             avg_ttk_ms, avg_reaction_ms, avg_overshoot_deg, avg_undershoot_deg, tracking_mad, \
             raw_metrics, difficulty_config) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            rusqlite::params![
                profile_id, stage_type, category, score, accuracy,
                avg_ttk_ms, avg_reaction_ms, avg_overshoot_deg, avg_undershoot_deg,
                tracking_mad, raw_metrics, difficulty_config
            ],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    /// 스테이지 결과 목록 조회 (최근 N개)
    pub fn get_stage_results(
        &self,
        profile_id: i64,
        limit: i64,
        stage_type: Option<&str>,
    ) -> Result<Vec<crate::training::commands::StageResultRow>> {
        let (sql, params_vec): (String, Vec<Box<dyn rusqlite::types::ToSql>>) = match stage_type {
            Some(st) => (
                "SELECT id, profile_id, stage_type, category, score, accuracy, avg_ttk_ms, \
                 avg_reaction_ms, avg_overshoot_deg, avg_undershoot_deg, tracking_mad, created_at \
                 FROM stage_results WHERE profile_id = ?1 AND stage_type = ?2 \
                 ORDER BY created_at DESC LIMIT ?3".into(),
                vec![
                    Box::new(profile_id) as Box<dyn rusqlite::types::ToSql>,
                    Box::new(st.to_string()),
                    Box::new(limit),
                ],
            ),
            None => (
                "SELECT id, profile_id, stage_type, category, score, accuracy, avg_ttk_ms, \
                 avg_reaction_ms, avg_overshoot_deg, avg_undershoot_deg, tracking_mad, created_at \
                 FROM stage_results WHERE profile_id = ?1 \
                 ORDER BY created_at DESC LIMIT ?2".into(),
                vec![
                    Box::new(profile_id) as Box<dyn rusqlite::types::ToSql>,
                    Box::new(limit),
                ],
            ),
        };
        let mut stmt = self.conn.prepare(&sql)?;
        let params_refs: Vec<&dyn rusqlite::types::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
        let rows = stmt.query_map(params_refs.as_slice(), |row| {
            Ok(crate::training::commands::StageResultRow {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                stage_type: row.get(2)?,
                category: row.get(3)?,
                score: row.get(4)?,
                accuracy: row.get(5)?,
                avg_ttk_ms: row.get(6)?,
                avg_reaction_ms: row.get(7)?,
                avg_overshoot_deg: row.get(8)?,
                avg_undershoot_deg: row.get(9)?,
                tracking_mad: row.get(10)?,
                created_at: row.get(11)?,
            })
        })?;
        rows.collect()
    }

    // ═══════════════════════════════════════════════════
    // Phase 5: 신규 테이블 CRUD
    // ═══════════════════════════════════════════════════

    // ── 크래시 로그 ──

    /// 크래시 로그 저장
    pub fn insert_crash_log(
        &self,
        error_type: &str,
        error_message: &str,
        stack_trace: Option<&str>,
        context: &str,
        app_version: &str,
    ) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO crash_logs (error_type, error_message, stack_trace, context, app_version) \
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![error_type, error_message, stack_trace, context, app_version],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    /// 최근 크래시 로그 조회
    pub fn get_crash_logs(&self, limit: i64) -> Result<Vec<CrashLogRow>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, error_type, error_message, stack_trace, context, app_version, created_at \
             FROM crash_logs ORDER BY created_at DESC LIMIT ?1"
        )?;
        let rows = stmt.query_map(rusqlite::params![limit], |row| {
            Ok(CrashLogRow {
                id: row.get(0)?,
                error_type: row.get(1)?,
                error_message: row.get(2)?,
                stack_trace: row.get(3)?,
                context: row.get(4)?,
                app_version: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?;
        rows.collect()
    }

    // ── 일별 통계 집계 ──

    /// 일별 통계 Upsert (INSERT OR UPDATE)
    pub fn upsert_daily_stat(
        &self,
        profile_id: i64,
        stat_date: &str,
        scenario_type: &str,
        score: f64,
        accuracy: f64,
        time_ms: i64,
    ) -> Result<()> {
        self.conn.execute(
            "INSERT INTO daily_stats (profile_id, stat_date, scenario_type, avg_score, max_score, \
             sessions_count, total_trials, total_time_ms, avg_accuracy) \
             VALUES (?1, ?2, ?3, ?4, ?4, 1, 1, ?5, ?6) \
             ON CONFLICT(profile_id, stat_date, scenario_type) DO UPDATE SET \
             avg_score = (daily_stats.avg_score * daily_stats.total_trials + ?4) / (daily_stats.total_trials + 1), \
             max_score = MAX(daily_stats.max_score, ?4), \
             sessions_count = daily_stats.sessions_count + 1, \
             total_trials = daily_stats.total_trials + 1, \
             total_time_ms = daily_stats.total_time_ms + ?5, \
             avg_accuracy = (daily_stats.avg_accuracy * daily_stats.total_trials + ?6) / (daily_stats.total_trials + 1)",
            rusqlite::params![profile_id, stat_date, scenario_type, score, time_ms, accuracy],
        )?;
        Ok(())
    }

    /// 일별 통계 조회
    pub fn get_daily_stats(
        &self,
        profile_id: i64,
        days: i64,
    ) -> Result<Vec<DailyStatRow>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, profile_id, stat_date, scenario_type, avg_score, max_score, \
             sessions_count, total_trials, total_time_ms, avg_accuracy \
             FROM daily_stats WHERE profile_id = ?1 \
             ORDER BY stat_date DESC LIMIT ?2"
        )?;
        let rows = stmt.query_map(rusqlite::params![profile_id, days], |row| {
            Ok(DailyStatRow {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                stat_date: row.get(2)?,
                scenario_type: row.get(3)?,
                avg_score: row.get(4)?,
                max_score: row.get(5)?,
                sessions_count: row.get(6)?,
                total_trials: row.get(7)?,
                total_time_ms: row.get(8)?,
                avg_accuracy: row.get(9)?,
            })
        })?;
        rows.collect()
    }

    // ── 스킬 진행도 ──

    /// 스킬 진행도 Upsert
    pub fn upsert_skill_progress(
        &self,
        profile_id: i64,
        stage_type: &str,
        score: f64,
        time_ms: i64,
    ) -> Result<()> {
        self.conn.execute(
            "INSERT INTO skill_progress (profile_id, stage_type, rolling_avg_score, best_score, \
             total_sessions, total_time_ms) \
             VALUES (?1, ?2, ?3, ?3, 1, ?4) \
             ON CONFLICT(profile_id, stage_type) DO UPDATE SET \
             rolling_avg_score = (skill_progress.rolling_avg_score * 0.9 + ?3 * 0.1), \
             best_score = MAX(skill_progress.best_score, ?3), \
             total_sessions = skill_progress.total_sessions + 1, \
             total_time_ms = skill_progress.total_time_ms + ?4, \
             last_updated = datetime('now')",
            rusqlite::params![profile_id, stage_type, score, time_ms],
        )?;
        Ok(())
    }

    /// 스킬 진행도 조회
    pub fn get_skill_progress(&self, profile_id: i64) -> Result<Vec<SkillProgressRow>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, profile_id, stage_type, rolling_avg_score, best_score, \
             total_sessions, total_time_ms, last_updated \
             FROM skill_progress WHERE profile_id = ?1 ORDER BY last_updated DESC"
        )?;
        let rows = stmt.query_map(rusqlite::params![profile_id], |row| {
            Ok(SkillProgressRow {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                stage_type: row.get(2)?,
                rolling_avg_score: row.get(3)?,
                best_score: row.get(4)?,
                total_sessions: row.get(5)?,
                total_time_ms: row.get(6)?,
                last_updated: row.get(7)?,
            })
        })?;
        rows.collect()
    }

    // ── 사용자 설정 ──

    /// 사용자 설정 저장 (Upsert)
    pub fn save_setting(
        &self,
        profile_id: i64,
        key: &str,
        value: &str,
    ) -> Result<()> {
        self.conn.execute(
            "INSERT INTO user_settings (profile_id, setting_key, setting_value) \
             VALUES (?1, ?2, ?3) \
             ON CONFLICT(profile_id, setting_key) DO UPDATE SET \
             setting_value = ?3, updated_at = datetime('now')",
            rusqlite::params![profile_id, key, value],
        )?;
        Ok(())
    }

    /// 사용자 설정 조회
    pub fn get_setting(&self, profile_id: i64, key: &str) -> Result<Option<String>> {
        let mut stmt = self.conn.prepare(
            "SELECT setting_value FROM user_settings WHERE profile_id = ?1 AND setting_key = ?2"
        )?;
        let mut rows = stmt.query_map(rusqlite::params![profile_id, key], |row| row.get(0))?;
        match rows.next() {
            Some(Ok(v)) => Ok(Some(v)),
            Some(Err(e)) => Err(e),
            None => Ok(None),
        }
    }

    /// 모든 사용자 설정 조회
    pub fn get_all_settings(&self, profile_id: i64) -> Result<Vec<(String, String)>> {
        let mut stmt = self.conn.prepare(
            "SELECT setting_key, setting_value FROM user_settings WHERE profile_id = ?1"
        )?;
        let rows = stmt.query_map(rusqlite::params![profile_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;
        rows.collect()
    }

    // ── 게임 프로필 ──

    /// 게임 프로필 생성
    pub fn insert_game_profile(
        &self,
        profile_id: i64,
        game_id: &str,
        game_name: &str,
        sens: f64,
        dpi: i64,
        fov: f64,
        cm360: f64,
        keybinds: &str,
    ) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO user_game_profiles (profile_id, game_id, game_name, custom_sens, \
             custom_dpi, custom_fov, custom_cm360, keybinds_json) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![profile_id, game_id, game_name, sens, dpi, fov, cm360, keybinds],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    /// 게임 프로필 목록 조회
    pub fn get_game_profiles(&self, profile_id: i64) -> Result<Vec<GameProfileRow>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, profile_id, game_id, game_name, custom_sens, custom_dpi, custom_fov, \
             custom_cm360, keybinds_json, is_active, created_at \
             FROM user_game_profiles WHERE profile_id = ?1 ORDER BY game_name"
        )?;
        let rows = stmt.query_map(rusqlite::params![profile_id], |row| {
            Ok(GameProfileRow {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                game_id: row.get(2)?,
                game_name: row.get(3)?,
                custom_sens: row.get(4)?,
                custom_dpi: row.get(5)?,
                custom_fov: row.get(6)?,
                custom_cm360: row.get(7)?,
                keybinds_json: row.get(8)?,
                is_active: row.get(9)?,
                created_at: row.get(10)?,
            })
        })?;
        rows.collect()
    }

    /// 게임 프로필 업데이트
    pub fn update_game_profile(
        &self,
        id: i64,
        sens: f64,
        dpi: i64,
        fov: f64,
        cm360: f64,
        keybinds: &str,
    ) -> Result<()> {
        self.conn.execute(
            "UPDATE user_game_profiles SET custom_sens = ?2, custom_dpi = ?3, custom_fov = ?4, \
             custom_cm360 = ?5, keybinds_json = ?6, updated_at = datetime('now') WHERE id = ?1",
            rusqlite::params![id, sens, dpi, fov, cm360, keybinds],
        )?;
        Ok(())
    }

    /// 게임 프로필 삭제
    pub fn delete_game_profile(&self, id: i64) -> Result<()> {
        self.conn.execute("DELETE FROM user_game_profiles WHERE id = ?1", rusqlite::params![id])?;
        Ok(())
    }

    /// 활성 게임 프로필 설정
    pub fn set_active_game_profile(&self, profile_id: i64, game_profile_id: i64) -> Result<()> {
        // 기존 활성 해제
        self.conn.execute(
            "UPDATE user_game_profiles SET is_active = 0 WHERE profile_id = ?1",
            rusqlite::params![profile_id],
        )?;
        // 새로 활성화
        self.conn.execute(
            "UPDATE user_game_profiles SET is_active = 1 WHERE id = ?1",
            rusqlite::params![game_profile_id],
        )?;
        Ok(())
    }

    // ── 커스텀 루틴 ──

    /// 루틴 생성
    pub fn insert_routine(
        &self,
        profile_id: i64,
        name: &str,
        description: &str,
    ) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO routines (profile_id, name, description) VALUES (?1, ?2, ?3)",
            rusqlite::params![profile_id, name, description],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    /// 루틴 목록 조회
    pub fn get_routines(&self, profile_id: i64) -> Result<Vec<RoutineRow>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, profile_id, name, description, total_duration_ms, created_at \
             FROM routines WHERE profile_id = ?1 ORDER BY updated_at DESC"
        )?;
        let rows = stmt.query_map(rusqlite::params![profile_id], |row| {
            Ok(RoutineRow {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                total_duration_ms: row.get(4)?,
                created_at: row.get(5)?,
            })
        })?;
        rows.collect()
    }

    /// 루틴 삭제 (CASCADE로 스텝도 삭제됨)
    pub fn delete_routine(&self, id: i64) -> Result<()> {
        self.conn.execute("DELETE FROM routines WHERE id = ?1", rusqlite::params![id])?;
        Ok(())
    }

    /// 루틴 스텝 추가
    pub fn insert_routine_step(
        &self,
        routine_id: i64,
        step_order: i64,
        stage_type: &str,
        duration_ms: i64,
        config_json: &str,
    ) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO routine_steps (routine_id, step_order, stage_type, duration_ms, config_json) \
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![routine_id, step_order, stage_type, duration_ms, config_json],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    /// 루틴 스텝 목록 조회
    pub fn get_routine_steps(&self, routine_id: i64) -> Result<Vec<RoutineStepRow>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, routine_id, step_order, stage_type, duration_ms, config_json \
             FROM routine_steps WHERE routine_id = ?1 ORDER BY step_order"
        )?;
        let rows = stmt.query_map(rusqlite::params![routine_id], |row| {
            Ok(RoutineStepRow {
                id: row.get(0)?,
                routine_id: row.get(1)?,
                step_order: row.get(2)?,
                stage_type: row.get(3)?,
                duration_ms: row.get(4)?,
                config_json: row.get(5)?,
            })
        })?;
        rows.collect()
    }

    /// 루틴 스텝 삭제
    pub fn delete_routine_step(&self, id: i64) -> Result<()> {
        self.conn.execute("DELETE FROM routine_steps WHERE id = ?1", rusqlite::params![id])?;
        Ok(())
    }

    /// 루틴 총 시간 업데이트
    pub fn update_routine_duration(&self, routine_id: i64) -> Result<()> {
        self.conn.execute(
            "UPDATE routines SET total_duration_ms = \
             (SELECT COALESCE(SUM(duration_ms), 0) FROM routine_steps WHERE routine_id = ?1), \
             updated_at = datetime('now') WHERE id = ?1",
            rusqlite::params![routine_id],
        )?;
        Ok(())
    }

    /// 두 루틴 스텝의 순서를 교환 (UNIQUE 제약 우회: 트랜잭션 + 임시 음수 order)
    pub fn swap_routine_step_order(&self, step_id_a: i64, step_id_b: i64) -> Result<()> {
        // 두 스텝의 현재 order 조회
        let order_a: i64 = self.conn.query_row(
            "SELECT step_order FROM routine_steps WHERE id = ?1",
            rusqlite::params![step_id_a],
            |row| row.get(0),
        )?;
        let order_b: i64 = self.conn.query_row(
            "SELECT step_order FROM routine_steps WHERE id = ?1",
            rusqlite::params![step_id_b],
            |row| row.get(0),
        )?;

        // 트랜잭션 내에서 교환 (임시 -9999로 UNIQUE 충돌 방지)
        let tx = self.conn.unchecked_transaction()?;
        tx.execute(
            "UPDATE routine_steps SET step_order = -9999 WHERE id = ?1",
            rusqlite::params![step_id_a],
        )?;
        tx.execute(
            "UPDATE routine_steps SET step_order = ?1 WHERE id = ?2",
            rusqlite::params![order_a, step_id_b],
        )?;
        tx.execute(
            "UPDATE routine_steps SET step_order = ?1 WHERE id = ?2",
            rusqlite::params![order_b, step_id_a],
        )?;
        tx.commit()?;
        Ok(())
    }

    /// DB 파일 경로 반환 (내보내기용)
    pub fn get_db_path(&self) -> Result<String> {
        let path: String = self.conn.query_row("PRAGMA database_list", [], |row| row.get(2))?;
        Ok(path)
    }

    // ── Readiness Score CRUD ──

    /// Readiness Score 저장
    pub fn insert_readiness_score(
        &self,
        profile_id: i64,
        score: f64,
        baseline_delta: &str,
        daily_advice: Option<&str>,
    ) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO readiness_scores (profile_id, score, baseline_delta, daily_advice) \
             VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![profile_id, score, baseline_delta, daily_advice],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    /// Readiness Score 히스토리 조회
    pub fn get_readiness_scores(&self, profile_id: i64, limit: i64) -> Result<Vec<ReadinessScoreRow>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, profile_id, score, baseline_delta, daily_advice, measured_at \
             FROM readiness_scores WHERE profile_id = ?1 \
             ORDER BY measured_at DESC LIMIT ?2"
        )?;
        let rows = stmt.query_map(rusqlite::params![profile_id, limit], |row| {
            Ok(ReadinessScoreRow {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                score: row.get(2)?,
                baseline_delta: row.get(3)?,
                daily_advice: row.get(4)?,
                measured_at: row.get(5)?,
            })
        })?;
        rows.collect()
    }

    /// 최신 Readiness Score 조회
    pub fn get_latest_readiness(&self, profile_id: i64) -> Result<Option<ReadinessScoreRow>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, profile_id, score, baseline_delta, daily_advice, measured_at \
             FROM readiness_scores WHERE profile_id = ?1 \
             ORDER BY measured_at DESC LIMIT 1"
        )?;
        let mut rows = stmt.query_map(rusqlite::params![profile_id], |row| {
            Ok(ReadinessScoreRow {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                score: row.get(2)?,
                baseline_delta: row.get(3)?,
                daily_advice: row.get(4)?,
                measured_at: row.get(5)?,
            })
        })?;
        match rows.next() {
            Some(Ok(row)) => Ok(Some(row)),
            Some(Err(e)) => Err(e),
            None => Ok(None),
        }
    }

    // ── Style Transition CRUD ──

    /// 스타일 전환 생성
    pub fn insert_style_transition(
        &self,
        profile_id: i64,
        from_type: &str,
        to_type: &str,
        target_sens_range: &str,
    ) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO style_transitions (profile_id, from_type, to_type, target_sens_range) \
             VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![profile_id, from_type, to_type, target_sens_range],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    /// 활성 스타일 전환 조회 (completed_at IS NULL)
    pub fn get_active_style_transition(&self, profile_id: i64) -> Result<Option<StyleTransitionRow>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, profile_id, from_type, to_type, target_sens_range, started_at, \
             current_phase, plateau_detected, completed_at \
             FROM style_transitions WHERE profile_id = ?1 AND completed_at IS NULL \
             ORDER BY started_at DESC LIMIT 1"
        )?;
        let mut rows = stmt.query_map(rusqlite::params![profile_id], |row| {
            Ok(StyleTransitionRow {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                from_type: row.get(2)?,
                to_type: row.get(3)?,
                target_sens_range: row.get(4)?,
                started_at: row.get(5)?,
                current_phase: row.get(6)?,
                plateau_detected: row.get(7)?,
                completed_at: row.get(8)?,
            })
        })?;
        match rows.next() {
            Some(Ok(row)) => Ok(Some(row)),
            Some(Err(e)) => Err(e),
            None => Ok(None),
        }
    }

    /// 스타일 전환 페이즈 업데이트
    pub fn update_style_transition_phase(&self, id: i64, current_phase: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE style_transitions SET current_phase = ?2 WHERE id = ?1",
            rusqlite::params![id, current_phase],
        )?;
        Ok(())
    }

    /// 스타일 전환 완료 처리
    pub fn complete_style_transition(&self, id: i64) -> Result<()> {
        self.conn.execute(
            "UPDATE style_transitions SET completed_at = datetime('now') WHERE id = ?1",
            rusqlite::params![id],
        )?;
        Ok(())
    }

    /// 플래토 감지 마킹
    pub fn mark_plateau_detected(&self, id: i64) -> Result<()> {
        self.conn.execute(
            "UPDATE style_transitions SET plateau_detected = 1 WHERE id = ?1",
            rusqlite::params![id],
        )?;
        Ok(())
    }

    // ── Movement Profile CRUD ──────────────────────────────

    /// 무브먼트 프로필 저장
    pub fn insert_movement_profile(
        &self,
        game_id: i64,
        name: &str,
        max_speed: f64,
        stop_time: f64,
        accel_type: &str,
        air_control: f64,
        cs_bonus: f64,
        is_custom: bool,
    ) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO movement_profiles (game_id, name, max_speed, stop_time, accel_type, air_control, cs_bonus, is_custom) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![game_id, name, max_speed, stop_time, accel_type, air_control, cs_bonus, is_custom as i32],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    /// 게임별 무브먼트 프로필 조회
    pub fn get_movement_profiles(&self, game_id: i64) -> Result<Vec<MovementProfileRow>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, game_id, name, max_speed, stop_time, accel_type, air_control, cs_bonus, is_custom \
             FROM movement_profiles WHERE game_id = ?1 ORDER BY is_custom ASC, id ASC"
        )?;
        let rows = stmt.query_map(rusqlite::params![game_id], |row| {
            Ok(MovementProfileRow {
                id: row.get(0)?,
                game_id: row.get(1)?,
                name: row.get(2)?,
                max_speed: row.get(3)?,
                stop_time: row.get(4)?,
                accel_type: row.get(5)?,
                air_control: row.get(6)?,
                cs_bonus: row.get(7)?,
                is_custom: row.get::<_, i32>(8)? != 0,
            })
        })?;
        rows.collect()
    }

    /// 무브먼트 프로필 단건 조회
    pub fn get_movement_profile(&self, id: i64) -> Result<Option<MovementProfileRow>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, game_id, name, max_speed, stop_time, accel_type, air_control, cs_bonus, is_custom \
             FROM movement_profiles WHERE id = ?1"
        )?;
        let mut rows = stmt.query_map(rusqlite::params![id], |row| {
            Ok(MovementProfileRow {
                id: row.get(0)?,
                game_id: row.get(1)?,
                name: row.get(2)?,
                max_speed: row.get(3)?,
                stop_time: row.get(4)?,
                accel_type: row.get(5)?,
                air_control: row.get(6)?,
                cs_bonus: row.get(7)?,
                is_custom: row.get::<_, i32>(8)? != 0,
            })
        })?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    /// 무브먼트 프로필 수정
    pub fn update_movement_profile(
        &self,
        id: i64,
        name: &str,
        max_speed: f64,
        stop_time: f64,
        accel_type: &str,
        air_control: f64,
        cs_bonus: f64,
    ) -> Result<()> {
        self.conn.execute(
            "UPDATE movement_profiles SET name = ?2, max_speed = ?3, stop_time = ?4, \
             accel_type = ?5, air_control = ?6, cs_bonus = ?7 WHERE id = ?1",
            rusqlite::params![id, name, max_speed, stop_time, accel_type, air_control, cs_bonus],
        )?;
        Ok(())
    }

    /// 무브먼트 프로필 삭제
    pub fn delete_movement_profile(&self, id: i64) -> Result<()> {
        self.conn.execute("DELETE FROM movement_profiles WHERE id = ?1", rusqlite::params![id])?;
        Ok(())
    }

    // ── Recoil Pattern CRUD ──────────────────────────────────

    /// 반동 패턴 목록 조회 (game_id 필터 옵션)
    pub fn get_recoil_patterns(&self, game_id: Option<i64>) -> Result<Vec<RecoilPatternRow>> {
        let map_row = |row: &rusqlite::Row| -> rusqlite::Result<RecoilPatternRow> {
            Ok(RecoilPatternRow {
                id: row.get(0)?, game_id: row.get(1)?, weapon_name: row.get(2)?,
                pattern_points: row.get(3)?, randomness: row.get(4)?,
                vertical: row.get(5)?, horizontal: row.get(6)?,
                rpm: row.get(7)?, is_custom: row.get::<_, i32>(8)? != 0,
            })
        };
        if let Some(gid) = game_id {
            let mut stmt = self.conn.prepare(
                "SELECT id, game_id, weapon_name, pattern_points, randomness, vertical, horizontal, rpm, is_custom \
                 FROM recoil_patterns WHERE game_id = ?1 ORDER BY is_custom ASC, id ASC"
            )?;
            let rows = stmt.query_map(rusqlite::params![gid], map_row)?;
            rows.collect()
        } else {
            let mut stmt = self.conn.prepare(
                "SELECT id, game_id, weapon_name, pattern_points, randomness, vertical, horizontal, rpm, is_custom \
                 FROM recoil_patterns ORDER BY game_id ASC, is_custom ASC, id ASC"
            )?;
            let rows = stmt.query_map([], map_row)?;
            rows.collect()
        }
    }

    /// 반동 패턴 저장 (커스텀, is_custom=1)
    pub fn insert_recoil_pattern(
        &self, game_id: i64, weapon_name: &str, pattern_points: &str,
        randomness: f64, vertical: f64, horizontal: f64, rpm: i64,
    ) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO recoil_patterns (game_id, weapon_name, pattern_points, randomness, vertical, horizontal, rpm, is_custom) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1)",
            rusqlite::params![game_id, weapon_name, pattern_points, randomness, vertical, horizontal, rpm],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    /// 반동 패턴 수정
    pub fn update_recoil_pattern(
        &self, id: i64, weapon_name: &str, pattern_points: &str,
        randomness: f64, vertical: f64, horizontal: f64, rpm: i64,
    ) -> Result<()> {
        self.conn.execute(
            "UPDATE recoil_patterns SET weapon_name = ?2, pattern_points = ?3, \
             randomness = ?4, vertical = ?5, horizontal = ?6, rpm = ?7 WHERE id = ?1",
            rusqlite::params![id, weapon_name, pattern_points, randomness, vertical, horizontal, rpm],
        )?;
        Ok(())
    }

    /// 반동 패턴 삭제 (커스텀만)
    pub fn delete_recoil_pattern(&self, id: i64) -> Result<()> {
        self.conn.execute(
            "DELETE FROM recoil_patterns WHERE id = ?1 AND is_custom = 1",
            rusqlite::params![id],
        )?;
        Ok(())
    }

    // ── FOV Profile CRUD ──────────────────────────────────

    /// FOV 테스트 결과 저장
    pub fn insert_fov_profile(
        &self,
        profile_id: i64,
        fov_tested: f64,
        scenario_type: &str,
        score: f64,
        peripheral_score: Option<f64>,
        center_score: Option<f64>,
    ) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO fov_profiles (profile_id, fov_tested, scenario_type, score, peripheral_score, center_score) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![profile_id, fov_tested, scenario_type, score, peripheral_score, center_score],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    /// FOV 테스트 결과 조회 (프로필별)
    pub fn get_fov_profiles(&self, profile_id: i64) -> Result<Vec<FovProfileRow>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, profile_id, fov_tested, scenario_type, score, peripheral_score, center_score, created_at \
             FROM fov_profiles WHERE profile_id = ?1 ORDER BY fov_tested ASC, created_at ASC"
        )?;
        let rows = stmt.query_map(rusqlite::params![profile_id], |row| {
            Ok(FovProfileRow {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                fov_tested: row.get(2)?,
                scenario_type: row.get(3)?,
                score: row.get(4)?,
                peripheral_score: row.get(5)?,
                center_score: row.get(6)?,
                created_at: row.get(7)?,
            })
        })?;
        rows.collect()
    }

    /// FOV 테스트 결과 삭제 (프로필별 전체)
    pub fn delete_fov_profiles(&self, profile_id: i64) -> Result<()> {
        self.conn.execute(
            "DELETE FROM fov_profiles WHERE profile_id = ?1",
            rusqlite::params![profile_id],
        )?;
        Ok(())
    }

    // ── Hardware Combo CRUD ──────────────────────────────

    /// 하드웨어 콤보 등록
    pub fn insert_hardware_combo(
        &self,
        mouse_model: &str,
        dpi: i64,
        verified_dpi: Option<i64>,
        polling_rate: Option<i64>,
        mousepad_model: Option<&str>,
    ) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO hardware_combos (mouse_model, dpi, verified_dpi, polling_rate, mousepad_model) \
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![mouse_model, dpi, verified_dpi, polling_rate, mousepad_model],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    /// 전체 하드웨어 콤보 조회
    pub fn get_hardware_combos(&self) -> Result<Vec<HardwareComboRow>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, mouse_model, dpi, verified_dpi, polling_rate, mousepad_model, created_at \
             FROM hardware_combos ORDER BY created_at DESC"
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(HardwareComboRow {
                id: row.get(0)?,
                mouse_model: row.get(1)?,
                dpi: row.get(2)?,
                verified_dpi: row.get(3)?,
                polling_rate: row.get(4)?,
                mousepad_model: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?;
        rows.collect()
    }

    /// 하드웨어 콤보 단건 조회
    pub fn get_hardware_combo(&self, id: i64) -> Result<Option<HardwareComboRow>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, mouse_model, dpi, verified_dpi, polling_rate, mousepad_model, created_at \
             FROM hardware_combos WHERE id = ?1"
        )?;
        let mut rows = stmt.query_map(rusqlite::params![id], |row| {
            Ok(HardwareComboRow {
                id: row.get(0)?,
                mouse_model: row.get(1)?,
                dpi: row.get(2)?,
                verified_dpi: row.get(3)?,
                polling_rate: row.get(4)?,
                mousepad_model: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    /// 하드웨어 콤보 수정
    pub fn update_hardware_combo(
        &self,
        id: i64,
        mouse_model: &str,
        dpi: i64,
        verified_dpi: Option<i64>,
        polling_rate: Option<i64>,
        mousepad_model: Option<&str>,
    ) -> Result<()> {
        self.conn.execute(
            "UPDATE hardware_combos SET mouse_model = ?2, dpi = ?3, verified_dpi = ?4, \
             polling_rate = ?5, mousepad_model = ?6 WHERE id = ?1",
            rusqlite::params![id, mouse_model, dpi, verified_dpi, polling_rate, mousepad_model],
        )?;
        Ok(())
    }

    /// 하드웨어 콤보 삭제
    pub fn delete_hardware_combo(&self, id: i64) -> Result<()> {
        self.conn.execute("DELETE FROM hardware_combos WHERE id = ?1", rusqlite::params![id])?;
        Ok(())
    }
}

/// 무브먼트 프로필 행
#[derive(Debug, Clone, Serialize)]
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

/// 스킬 진행도 행
#[derive(Debug, Serialize)]
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

-- 빠른 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_stage_results_profile_type ON stage_results(profile_id, stage_type, created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_profile_started ON sessions(profile_id, started_at);
CREATE INDEX IF NOT EXISTS idx_trials_session ON trials(session_id, created_at);
"#;
