/// 훈련 처방 + 크로스게임 + 스테이지 + Readiness + Style Transition CRUD
use rusqlite::Result;
use super::{ReadinessScoreRow, StyleTransitionRow};

impl super::Database {
    // ── Training 처방 CRUD ──

    /// 훈련 처방 저장 — ID 반환
    /// (인수 다수: DB 컬럼 직접 매핑)
    #[allow(clippy::too_many_arguments)]
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

    // ── Cross-game CRUD ──

    /// 크로스게임 비교 결과 저장 — ID 반환
    /// (인수 다수: DB 컬럼 직접 매핑)
    #[allow(clippy::too_many_arguments)]
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
    /// (인수 다수: DB 컬럼 직접 매핑)
    #[allow(clippy::too_many_arguments)]
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
}
