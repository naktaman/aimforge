/// 캘리브레이션 + GP + 줌 CRUD
use rusqlite::Result;
use super::ZoomProfileRow;

impl super::Database {
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
}
