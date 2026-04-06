/// Aim DNA + 스냅샷 + 변경점 이벤트 + 레퍼런스 게임 CRUD
use rusqlite::Result;

impl super::Database {
    /// Aim DNA 프로파일 저장 — ID 반환
    pub fn insert_aim_dna(&self, dna: &crate::aim_dna::AimDnaProfile) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO aim_dna (profile_id, session_id, flick_peak_velocity, overshoot_avg, \
             direction_bias, effective_range, tracking_mad, phase_lag, smoothness, velocity_match, \
             micro_freq, wrist_arm_ratio, fitts_a, fitts_b, fatigue_decay, pre_aim_ratio, \
             pre_fire_ratio, sens_attributed_overshoot, v_h_ratio, finger_accuracy, wrist_accuracy, \
             arm_accuracy, motor_transition_angle, type_label) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, \
             ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24)",
            rusqlite::params![
                dna.profile_id, dna.session_id,
                dna.flick_peak_velocity, dna.overshoot_avg,
                dna.direction_bias, dna.effective_range,
                dna.tracking_mad, dna.phase_lag, dna.smoothness, dna.velocity_match,
                dna.micro_freq, dna.wrist_arm_ratio, dna.fitts_a, dna.fitts_b,
                dna.fatigue_decay, dna.pre_aim_ratio, dna.pre_fire_ratio,
                dna.sens_attributed_overshoot, dna.v_h_ratio,
                dna.finger_accuracy, dna.wrist_accuracy, dna.arm_accuracy,
                dna.motor_transition_angle, dna.type_label
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
             motor_transition_angle, type_label \
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
                type_label: row.get(23)?,
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

    // ── DNA 스냅샷 + 변경점 이벤트 ──

    /// DNA 스냅샷 저장 — 매 DNA 측정마다 5축 점수 보존
    /// (인수 다수: DB 컬럼 직접 매핑)
    #[allow(clippy::too_many_arguments)]
    pub fn insert_dna_snapshot(
        &self,
        profile_id: i64,
        aim_dna_id: i64,
        flick_power: f64,
        tracking_precision: f64,
        motor_control: f64,
        speed: f64,
        consistency: f64,
        type_label: Option<&str>,
        cm360: Option<f64>,
    ) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO aim_dna_snapshots \
             (profile_id, aim_dna_id, flick_power, tracking_precision, motor_control, speed, consistency, type_label, cm360_sensitivity) \
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
            rusqlite::params![profile_id, aim_dna_id, flick_power, tracking_precision, motor_control, speed, consistency, type_label, cm360],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    /// DNA 스냅샷 목록 조회 — 최근 N회 (오래된 순 정렬)
    pub fn get_dna_snapshots(
        &self,
        profile_id: i64,
        limit: i64,
    ) -> Result<Vec<crate::aim_dna::commands::DnaSnapshot>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, profile_id, aim_dna_id, flick_power, tracking_precision, motor_control, speed, consistency, type_label, cm360_sensitivity, measured_at \
             FROM aim_dna_snapshots WHERE profile_id = ?1 \
             ORDER BY measured_at DESC LIMIT ?2"
        )?;
        let rows = stmt.query_map(rusqlite::params![profile_id, limit], |row| {
            Ok(crate::aim_dna::commands::DnaSnapshot {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                aim_dna_id: row.get(2)?,
                flick_power: row.get(3)?,
                tracking_precision: row.get(4)?,
                motor_control: row.get(5)?,
                speed: row.get(6)?,
                consistency: row.get(7)?,
                type_label: row.get(8)?,
                cm360_sensitivity: row.get(9)?,
                measured_at: row.get(10)?,
            })
        })?;
        let mut snapshots: Vec<_> = rows.collect::<Result<Vec<_>>>()?;
        // 오래된 순으로 정렬 (차트 시계열용)
        snapshots.reverse();
        Ok(snapshots)
    }

    /// 변경점 이벤트 저장 — 기어/감도/그립/자세 변경 시
    pub fn insert_change_event(
        &self,
        profile_id: i64,
        change_type: &str,
        before_value: Option<&str>,
        after_value: &str,
        description: &str,
    ) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO aim_dna_change_events (profile_id, change_type, before_value, after_value, description) \
             VALUES (?1,?2,?3,?4,?5)",
            rusqlite::params![profile_id, change_type, before_value, after_value, description],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    /// 변경점 이벤트 목록 조회 — 최근 N회
    pub fn get_change_events(
        &self,
        profile_id: i64,
        limit: i64,
    ) -> Result<Vec<crate::aim_dna::commands::DnaChangeEvent>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, profile_id, change_type, before_value, after_value, description, occurred_at \
             FROM aim_dna_change_events WHERE profile_id = ?1 \
             ORDER BY occurred_at DESC LIMIT ?2"
        )?;
        let rows = stmt.query_map(rusqlite::params![profile_id, limit], |row| {
            Ok(crate::aim_dna::commands::DnaChangeEvent {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                change_type: row.get(2)?,
                before_value: row.get(3)?,
                after_value: row.get(4)?,
                description: row.get(5)?,
                occurred_at: row.get(6)?,
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
            .filter_map(|r| match r {
                Ok(v) => Some(v),
                Err(e) => {
                    log::warn!("프로파일 ID 행 읽기 실패: {}", e);
                    None
                }
            })
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
}
