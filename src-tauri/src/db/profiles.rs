/// 사용자 설정 + 게임 프로필 + 루틴 CRUD
use rusqlite::Result;
use super::{GameProfileRow, RoutineRow, RoutineStepRow};

impl super::Database {
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
    /// (인수 다수: DB 컬럼 직접 매핑)
    #[allow(clippy::too_many_arguments)]
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
}
