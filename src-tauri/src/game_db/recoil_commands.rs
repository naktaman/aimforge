/// 반동 패턴 Tauri IPC 커맨드

use crate::error::{AppError, PublicError, lock_state};
use crate::validate;
use crate::AppState;
use serde::Deserialize;
use tauri::State;

use crate::db::RecoilPatternRow;

/// 반동 패턴 조회 파라미터
#[derive(Deserialize)]
pub struct GetRecoilPatternsParams {
    pub game_id: Option<i64>,
}

/// 반동 패턴 목록 조회
#[tauri::command]
pub fn get_recoil_patterns(
    state: State<AppState>,
    params: GetRecoilPatternsParams,
) -> Result<Vec<RecoilPatternRow>, PublicError> {
    if let Some(gid) = params.game_id {
        validate::id(gid, "game_id")?;
    }
    let db = lock_state(&state.db)?;
    db.get_recoil_patterns(params.game_id)
        .map_err(|e| AppError::Database(e.to_string()).into())
}

/// 반동 패턴 저장 파라미터
#[derive(Deserialize)]
pub struct SaveRecoilPatternParams {
    pub game_id: i64,
    pub weapon_name: String,
    pub pattern_points: String,
    pub randomness: f64,
    pub vertical: f64,
    pub horizontal: f64,
    pub rpm: i64,
}

/// 커스텀 반동 패턴 저장 — ID 반환
#[tauri::command]
pub fn save_recoil_pattern(
    state: State<AppState>,
    params: SaveRecoilPatternParams,
) -> Result<i64, PublicError> {
    validate::id(params.game_id, "game_id")?;
    validate::non_empty_str(&params.weapon_name, "weapon_name")?;
    validate::non_empty_str(&params.pattern_points, "pattern_points")?;

    let db = lock_state(&state.db)?;
    db.insert_recoil_pattern(
        params.game_id, &params.weapon_name, &params.pattern_points,
        params.randomness, params.vertical, params.horizontal, params.rpm,
    ).map_err(|e| AppError::Database(e.to_string()).into())
}

/// 반동 패턴 수정 파라미터
#[derive(Deserialize)]
pub struct UpdateRecoilPatternParams {
    pub id: i64,
    pub weapon_name: String,
    pub pattern_points: String,
    pub randomness: f64,
    pub vertical: f64,
    pub horizontal: f64,
    pub rpm: i64,
}

/// 반동 패턴 수정
#[tauri::command]
pub fn update_recoil_pattern(
    state: State<AppState>,
    params: UpdateRecoilPatternParams,
) -> Result<(), PublicError> {
    validate::id(params.id, "id")?;
    validate::non_empty_str(&params.weapon_name, "weapon_name")?;
    validate::non_empty_str(&params.pattern_points, "pattern_points")?;

    let db = lock_state(&state.db)?;
    db.update_recoil_pattern(
        params.id, &params.weapon_name, &params.pattern_points,
        params.randomness, params.vertical, params.horizontal, params.rpm,
    ).map_err(|e| AppError::Database(e.to_string()).into())
}

/// 반동 패턴 삭제 파라미터
#[derive(Deserialize)]
pub struct DeleteRecoilPatternParams {
    pub id: i64,
}

/// 커스텀 반동 패턴 삭제
#[tauri::command]
pub fn delete_recoil_pattern(
    state: State<AppState>,
    params: DeleteRecoilPatternParams,
) -> Result<(), PublicError> {
    validate::id(params.id, "id")?;
    let db = lock_state(&state.db)?;
    db.delete_recoil_pattern(params.id)
        .map_err(|e| AppError::Database(e.to_string()).into())
}
