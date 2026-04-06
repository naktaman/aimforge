/// 통계 집계 + 크래시 로그 + 아카이브 + DB 최적화
use rusqlite::Result;
use super::{CrashLogRow, DailyStatRow, SkillProgressRow, WeeklyStatRow};

impl super::Database {
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

    // ── 주별 통계 + 아카이브 + DB 최적화 ──

    /// 주별 통계 조회 (weekly_stats 뷰 활용)
    /// weeks: 조회할 주 수 (기본 12주)
    pub fn get_weekly_stats(
        &self,
        profile_id: i64,
        weeks: i64,
    ) -> Result<Vec<WeeklyStatRow>> {
        let mut stmt = self.conn.prepare(
            "SELECT profile_id, week_start, scenario_type, avg_score, max_score, \
             sessions_count, total_trials, total_time_ms, avg_accuracy \
             FROM weekly_stats WHERE profile_id = ?1 \
             AND week_start >= date('now', '-' || ?2 || ' days') \
             ORDER BY week_start DESC"
        )?;
        let rows = stmt.query_map(rusqlite::params![profile_id, weeks * 7], |row| {
            Ok(WeeklyStatRow {
                profile_id: row.get(0)?,
                week_start: row.get(1)?,
                scenario_type: row.get(2)?,
                avg_score: row.get(3)?,
                max_score: row.get(4)?,
                sessions_count: row.get(5)?,
                total_trials: row.get(6)?,
                total_time_ms: row.get(7)?,
                avg_accuracy: row.get(8)?,
            })
        })?;
        rows.collect()
    }

    /// 오래된 트라이얼의 대용량 raw 데이터를 아카이브 (경량화)
    /// days_old 이전의 트라이얼에서 mouse_trajectory, raw_metrics 컬럼을 비움
    /// composite_score, angle_breakdown, motor_breakdown은 유지
    /// 반환: 아카이브된 트라이얼 수
    pub fn archive_old_trials(&self, days_old: i64) -> Result<usize> {
        let affected = self.conn.execute(
            "UPDATE trials SET \
             mouse_trajectory = '[]', \
             raw_metrics = '{}' \
             WHERE created_at < datetime('now', '-' || ?1 || ' days') \
             AND mouse_trajectory != '[]'",
            rusqlite::params![days_old],
        )?;
        Ok(affected)
    }

    /// DB 최적화 실행 (VACUUM + ANALYZE)
    /// 대량 삭제/아카이브 후 호출하여 디스크 공간 회수 및 쿼리 플래너 통계 갱신
    pub fn optimize_db(&self) -> Result<()> {
        self.conn.execute_batch("ANALYZE; PRAGMA optimize;")?;
        Ok(())
    }
}
