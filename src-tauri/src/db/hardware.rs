/// 무브먼트 프로필 + 반동 패턴 + FOV + 하드웨어 콤보 CRUD
use rusqlite::Result;
use super::{MovementProfileRow, RecoilPatternRow, FovProfileRow, HardwareComboRow};

impl super::Database {
    // ── Movement Profile CRUD ──

    /// 무브먼트 프로필 저장
    /// (인수 다수: DB 컬럼 직접 매핑)
    #[allow(clippy::too_many_arguments)]
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
    /// (인수 다수: DB 컬럼 직접 매핑)
    #[allow(clippy::too_many_arguments)]
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

    // ── Recoil Pattern CRUD ──

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
    /// (인수 다수: DB 컬럼 직접 매핑)
    #[allow(clippy::too_many_arguments)]
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
    /// (인수 다수: DB 컬럼 직접 매핑)
    #[allow(clippy::too_many_arguments)]
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

    // ── FOV Profile CRUD ──

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

    // ── Hardware Combo CRUD ──

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
