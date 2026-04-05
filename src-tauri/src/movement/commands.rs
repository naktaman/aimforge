//! Movement 시스템 Tauri IPC 커맨드

use crate::error::{AppError, PublicError, lock_state};
use crate::validate;
use crate::AppState;
use serde::Deserialize;
use tauri::{Manager, State};

use super::{
    get_default_presets, calculate_weighted_cm360, calculate_max_speed_from_wall_time,
    get_calibration_distance, MovementPreset, MovementExportData, WeightedRecommendation,
};
use crate::db::MovementProfileRow;

/// 10개 게임 기본 무브먼트 프리셋 반환
#[tauri::command]
pub fn get_movement_presets() -> Vec<MovementPreset> {
    get_default_presets()
}

/// 게임별 무브먼트 프로필 조회 파라미터
#[derive(Deserialize)]
pub struct GetMovementProfilesParams {
    pub game_id: i64,
}

/// DB에서 게임별 무브먼트 프로필 조회
#[tauri::command]
pub fn get_movement_profiles(
    state: State<AppState>,
    params: GetMovementProfilesParams,
) -> Result<Vec<MovementProfileRow>, PublicError> {
    validate::id(params.game_id, "game_id")?;
    let db = lock_state(&state.db)?;
    db.get_movement_profiles(params.game_id)
        .map_err(|e| AppError::Database(e.to_string()).into())
}

/// 무브먼트 프로필 저장 파라미터
#[derive(Deserialize)]
pub struct SaveMovementProfileParams {
    pub game_id: i64,
    pub name: String,
    pub max_speed: f64,
    pub stop_time: f64,
    pub accel_type: String,
    pub air_control: f64,
    pub cs_bonus: f64,
}

/// 커스텀 무브먼트 프로필 저장
#[tauri::command]
pub fn save_movement_profile(
    state: State<AppState>,
    params: SaveMovementProfileParams,
) -> Result<i64, PublicError> {
    validate::id(params.game_id, "game_id")?;
    validate::non_empty_str(&params.name, "name")?;
    validate::positive_f64(params.max_speed, "max_speed")?;
    validate::non_negative_f64(params.stop_time, "stop_time")?;
    validate::non_empty_str(&params.accel_type, "accel_type")?;

    let db = lock_state(&state.db)?;
    db.insert_movement_profile(
        params.game_id,
        &params.name,
        params.max_speed,
        params.stop_time,
        &params.accel_type,
        params.air_control,
        params.cs_bonus,
        true, // 커스텀
    )
    .map_err(|e| AppError::Database(e.to_string()).into())
}

/// 무브먼트 프로필 수정 파라미터
#[derive(Deserialize)]
pub struct UpdateMovementProfileParams {
    pub id: i64,
    pub name: String,
    pub max_speed: f64,
    pub stop_time: f64,
    pub accel_type: String,
    pub air_control: f64,
    pub cs_bonus: f64,
}

/// 무브먼트 프로필 수정
#[tauri::command]
pub fn update_movement_profile(
    state: State<AppState>,
    params: UpdateMovementProfileParams,
) -> Result<(), PublicError> {
    validate::id(params.id, "id")?;
    validate::non_empty_str(&params.name, "name")?;
    validate::positive_f64(params.max_speed, "max_speed")?;
    validate::non_negative_f64(params.stop_time, "stop_time")?;
    validate::non_empty_str(&params.accel_type, "accel_type")?;

    let db = lock_state(&state.db)?;
    db.update_movement_profile(
        params.id,
        &params.name,
        params.max_speed,
        params.stop_time,
        &params.accel_type,
        params.air_control,
        params.cs_bonus,
    )
    .map_err(|e| AppError::Database(e.to_string()).into())
}

/// 무브먼트 프로필 삭제 파라미터
#[derive(Deserialize)]
pub struct DeleteMovementProfileParams {
    pub id: i64,
}

/// 무브먼트 프로필 삭제
#[tauri::command]
pub fn delete_movement_profile(
    state: State<AppState>,
    params: DeleteMovementProfileParams,
) -> Result<(), PublicError> {
    validate::id(params.id, "id")?;
    let db = lock_state(&state.db)?;
    db.delete_movement_profile(params.id)
        .map_err(|e| AppError::Database(e.to_string()).into())
}

/// 가중 추천 계산 파라미터
#[derive(Deserialize)]
pub struct WeightedRecommendationParams {
    pub static_optimal: f64,
    pub moving_optimal: f64,
    pub movement_ratio: f64,
}

/// 정적/무빙 최적값 + movement_ratio → 최종 cm360 추천
#[tauri::command]
pub fn calculate_weighted_recommendation(
    params: WeightedRecommendationParams,
) -> WeightedRecommendation {
    calculate_weighted_cm360(
        params.static_optimal,
        params.moving_optimal,
        params.movement_ratio,
    )
}

/// 무브먼트 프로필 JSON 내보내기 파라미터
#[derive(Deserialize)]
pub struct ExportMovementProfileParams {
    pub game_id: String,
    pub name: String,
    pub max_speed: f64,
    pub stop_time: f64,
    pub accel_type: String,
    pub air_control: f64,
    pub cs_bonus: f64,
}

/// 무브먼트 프로필을 JSON 파일로 내보내기 — app_data_dir에 저장, 경로 반환
#[tauri::command]
pub fn export_movement_profile(
    app_handle: tauri::AppHandle,
    params: ExportMovementProfileParams,
) -> Result<String, PublicError> {
    validate::non_empty_str(&params.game_id, "game_id")?;
    validate::non_empty_str(&params.name, "name")?;
    validate::positive_f64(params.max_speed, "max_speed")?;

    let export_data = MovementExportData {
        version: 1,
        game_id: params.game_id,
        name: params.name.clone(),
        max_speed: params.max_speed,
        stop_time: params.stop_time,
        accel_type: params.accel_type,
        air_control: params.air_control,
        cs_bonus: params.cs_bonus,
    };
    export_data.validate()
        .map_err(|e| AppError::Validation(e))?;

    let json = serde_json::to_string_pretty(&export_data)
        .map_err(|e| AppError::Internal(format!("JSON 직렬화 실패: {}", e)))?;

    // app_data_dir/exports/ 디렉토리에 저장
    let app_dir = app_handle.path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("앱 데이터 디렉토리 조회 실패: {}", e)))?;
    let export_dir = app_dir.join("exports");
    std::fs::create_dir_all(&export_dir)
        .map_err(|e| AppError::Internal(format!("디렉토리 생성 실패: {}", e)))?;

    // 파일명: movement_{name}_{timestamp}.json
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let safe_name = params.name.replace(|c: char| !c.is_alphanumeric() && c != '_', "_");
    let filename = format!("movement_{}_{}.json", safe_name, timestamp);
    let file_path = export_dir.join(&filename);

    std::fs::write(&file_path, json)
        .map_err(|e| AppError::Internal(format!("파일 저장 실패: {}", e)))?;

    Ok(file_path.to_string_lossy().to_string())
}

/// JSON 문자열로부터 무브먼트 프로필 가져오기
#[tauri::command]
pub fn import_movement_profile_from_string(
    json_string: String,
) -> Result<MovementPreset, PublicError> {
    validate::non_empty_str(&json_string, "json_string")?;
    let export_data: MovementExportData = serde_json::from_str(&json_string)
        .map_err(|e| AppError::Validation(format!("JSON 파싱 실패: {}", e)))?;
    export_data.validate()
        .map_err(|e| AppError::Validation(e))?;
    Ok(export_data.to_preset())
}

/// 캘리브레이션 파라미터
#[derive(Deserialize)]
pub struct CalibrateMaxSpeedParams {
    pub game_id: String,
    pub distance_units: f64,
    pub measured_time_sec: f64,
}

/// 캘리브레이션 결과
#[derive(serde::Serialize)]
pub struct CalibrateMaxSpeedResult {
    /// 계산된 max_speed (u/s)
    pub calculated_max_speed: f64,
    /// 사용된 거리
    pub distance_used: f64,
}

/// 벽 도달 시간 측정값으로 max_speed 자동 계산
#[tauri::command]
pub fn calibrate_max_speed(
    params: CalibrateMaxSpeedParams,
) -> Result<CalibrateMaxSpeedResult, PublicError> {
    validate::non_empty_str(&params.game_id, "game_id")?;
    validate::positive_f64(params.measured_time_sec, "measured_time_sec")?;

    // 거리: 직접 입력값 사용 (0이면 게임 기본값 fallback)
    let distance = if params.distance_units > 0.0 {
        params.distance_units
    } else {
        get_calibration_distance(&params.game_id)
            .ok_or_else(|| AppError::NotFound(
                format!("게임 '{}'의 기본 캘리브레이션 거리가 없습니다", params.game_id)
            ))?
    };

    let speed = calculate_max_speed_from_wall_time(distance, params.measured_time_sec)
        .map_err(|e| AppError::Validation(e))?;

    Ok(CalibrateMaxSpeedResult {
        calculated_max_speed: (speed * 10.0).round() / 10.0, // 소수점 1자리 반올림
        distance_used: distance,
    })
}
