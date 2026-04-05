//! Hardware 콤보 비교 Tauri IPC 커맨드

use crate::error::{AppError, PublicError, lock_state};
use crate::validate;
use crate::AppState;
use serde::Deserialize;
use tauri::State;

use super::{compare_hardware, HardwareCombo, HardwareComparison};
use crate::db::HardwareComboRow;

/// 하드웨어 콤보 등록 파라미터
#[derive(Deserialize)]
pub struct SaveHardwareComboParams {
    pub mouse_model: String,
    pub dpi: i64,
    pub verified_dpi: Option<i64>,
    pub polling_rate: Option<i64>,
    pub mousepad_model: Option<String>,
}

/// 하드웨어 콤보 등록
#[tauri::command]
pub fn save_hardware_combo(
    state: State<AppState>,
    params: SaveHardwareComboParams,
) -> Result<i64, PublicError> {
    validate::non_empty_str(&params.mouse_model, "mouse_model")?;
    validate::dpi_i64(params.dpi)?;
    if let Some(v) = params.verified_dpi {
        validate::dpi_i64(v)?;
    }

    let db = lock_state(&state.db)?;
    db.insert_hardware_combo(
        &params.mouse_model,
        params.dpi,
        params.verified_dpi,
        params.polling_rate,
        params.mousepad_model.as_deref(),
    )
    .map_err(|e| AppError::Database(e.to_string()).into())
}

/// 전체 하드웨어 콤보 조회
#[tauri::command]
pub fn get_hardware_combos(
    state: State<AppState>,
) -> Result<Vec<HardwareComboRow>, PublicError> {
    let db = lock_state(&state.db)?;
    db.get_hardware_combos()
        .map_err(|e| AppError::Database(e.to_string()).into())
}

/// 하드웨어 콤보 수정 파라미터
#[derive(Deserialize)]
pub struct UpdateHardwareComboParams {
    pub id: i64,
    pub mouse_model: String,
    pub dpi: i64,
    pub verified_dpi: Option<i64>,
    pub polling_rate: Option<i64>,
    pub mousepad_model: Option<String>,
}

/// 하드웨어 콤보 수정
#[tauri::command]
pub fn update_hardware_combo(
    state: State<AppState>,
    params: UpdateHardwareComboParams,
) -> Result<(), PublicError> {
    validate::id(params.id, "id")?;
    validate::non_empty_str(&params.mouse_model, "mouse_model")?;
    validate::dpi_i64(params.dpi)?;
    if let Some(v) = params.verified_dpi {
        validate::dpi_i64(v)?;
    }

    let db = lock_state(&state.db)?;
    db.update_hardware_combo(
        params.id,
        &params.mouse_model,
        params.dpi,
        params.verified_dpi,
        params.polling_rate,
        params.mousepad_model.as_deref(),
    )
    .map_err(|e| AppError::Database(e.to_string()).into())
}

/// 하드웨어 콤보 삭제 파라미터
#[derive(Deserialize)]
pub struct DeleteHardwareComboParams {
    pub id: i64,
}

/// 하드웨어 콤보 삭제
#[tauri::command]
pub fn delete_hardware_combo(
    state: State<AppState>,
    params: DeleteHardwareComboParams,
) -> Result<(), PublicError> {
    validate::id(params.id, "id")?;
    let db = lock_state(&state.db)?;
    db.delete_hardware_combo(params.id)
        .map_err(|e| AppError::Database(e.to_string()).into())
}

/// 하드웨어 비교 파라미터
#[derive(Deserialize)]
pub struct CompareHardwareCombosParams {
    pub profile_a_id: i64,
    pub profile_b_id: i64,
}

/// 두 프로필의 하드웨어 콤보 + DNA + 최적 cm360 비교
#[tauri::command]
pub fn compare_hardware_combos(
    state: State<AppState>,
    params: CompareHardwareCombosParams,
) -> Result<HardwareComparison, PublicError> {
    validate::id(params.profile_a_id, "profile_a_id")?;
    validate::id(params.profile_b_id, "profile_b_id")?;

    let db = lock_state(&state.db)?;

    // 프로필에서 hardware_combo_id 추출 및 최적 cm360 조회
    let opt_a = db.get_profile_cm360(params.profile_a_id)
        .map_err(|e| AppError::Database(e.to_string()))?
        .unwrap_or(0.0);
    let opt_b = db.get_profile_cm360(params.profile_b_id)
        .map_err(|e| AppError::Database(e.to_string()))?
        .unwrap_or(0.0);

    // DNA 조회
    let dna_a = db.get_latest_aim_dna(params.profile_a_id)
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or_else(|| AppError::NotFound("프로필 A의 Aim DNA가 없습니다.".to_string()))?;
    let dna_b = db.get_latest_aim_dna(params.profile_b_id)
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or_else(|| AppError::NotFound("프로필 B의 Aim DNA가 없습니다.".to_string()))?;

    // hardware_combo_id로 콤보 정보 조회
    let combo_a_row = get_hardware_for_profile(&db, params.profile_a_id)?;
    let combo_b_row = get_hardware_for_profile(&db, params.profile_b_id)?;

    let combo_a = row_to_combo(&combo_a_row);
    let combo_b = row_to_combo(&combo_b_row);

    let features_a = dna_a.to_feature_pairs();
    let features_b = dna_b.to_feature_pairs();

    Ok(compare_hardware(combo_a, combo_b, opt_a, opt_b, &features_a, &features_b))
}

/// 프로필에서 하드웨어 콤보 조회 헬퍼
fn get_hardware_for_profile(
    db: &crate::db::Database,
    profile_id: i64,
) -> Result<HardwareComboRow, PublicError> {
    // profiles 테이블에서 hardware_combo_id 조회
    let combo_id: Option<i64> = db.conn()
        .query_row(
            "SELECT hardware_combo_id FROM profiles WHERE id = ?1",
            rusqlite::params![profile_id],
            |row| row.get(0),
        )
        .map_err(|e| AppError::Database(format!("프로필 {} 조회 실패: {}", profile_id, e)))?;

    let combo_id = combo_id
        .ok_or_else(|| AppError::NotFound(format!("프로필 {}에 하드웨어 콤보가 연결되지 않았습니다.", profile_id)))?;

    db.get_hardware_combo(combo_id)
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or_else(|| AppError::NotFound(format!("하드웨어 콤보 {}을(를) 찾을 수 없습니다.", combo_id)).into())
}

/// HardwareComboRow → HardwareCombo 변환
fn row_to_combo(row: &HardwareComboRow) -> HardwareCombo {
    HardwareCombo {
        id: row.id,
        mouse_model: row.mouse_model.clone(),
        dpi: row.dpi,
        verified_dpi: Some(row.verified_dpi.unwrap_or(row.dpi)),
        polling_rate: row.polling_rate,
        mousepad_model: row.mousepad_model.clone(),
    }
}
