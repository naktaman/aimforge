/// 세션 + 트라이얼 CRUD
use rusqlite::Result;

impl super::Database {
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
}
