//! FOV 프로파일 Tauri IPC 커맨드

use crate::error::{AppError, PublicError, lock_state};
use crate::validate;
use crate::AppState;
use serde::Deserialize;
use tauri::State;

use super::{compare_fov_results, FovTestResult, FovRecommendation};
use crate::db::FovProfileRow;

/// FOV 테스트 결과 저장 파라미터
#[derive(Deserialize)]
pub struct SaveFovTestResultParams {
    pub profile_id: i64,
    pub fov_tested: f64,
    pub scenario_type: String,
    pub score: f64,
    pub peripheral_score: Option<f64>,
    pub center_score: Option<f64>,
}

/// FOV 테스트 결과 저장
#[tauri::command]
pub fn save_fov_test_result(
    state: State<AppState>,
    params: SaveFovTestResultParams,
) -> Result<i64, PublicError> {
    validate::id(params.profile_id, "profile_id")?;
    validate::fov(params.fov_tested)?;
    validate::non_empty_str(&params.scenario_type, "scenario_type")?;

    let db = lock_state(&state.db)?;
    db.insert_fov_profile(
        params.profile_id,
        params.fov_tested,
        &params.scenario_type,
        params.score,
        params.peripheral_score,
        params.center_score,
    )
    .map_err(|e| AppError::Database(e.to_string()).into())
}

/// FOV 테스트 결과 조회 파라미터
#[derive(Deserialize)]
pub struct GetFovTestResultsParams {
    pub profile_id: i64,
}

/// FOV 테스트 결과 조회
#[tauri::command]
pub fn get_fov_test_results(
    state: State<AppState>,
    params: GetFovTestResultsParams,
) -> Result<Vec<FovProfileRow>, PublicError> {
    validate::id(params.profile_id, "profile_id")?;
    let db = lock_state(&state.db)?;
    db.get_fov_profiles(params.profile_id)
        .map_err(|e| AppError::Database(e.to_string()).into())
}

/// FOV 비교 분석 파라미터
#[derive(Deserialize)]
pub struct CompareFovProfilesParams {
    pub profile_id: i64,
}

/// FOV 비교 분석 실행 — DB에서 데이터 로드 후 비교
#[tauri::command]
pub fn compare_fov_profiles(
    state: State<AppState>,
    params: CompareFovProfilesParams,
) -> Result<Option<FovRecommendation>, PublicError> {
    validate::id(params.profile_id, "profile_id")?;
    let db = lock_state(&state.db)?;
    let rows = db.get_fov_profiles(params.profile_id)
        .map_err(|e| AppError::Database(e.to_string()))?;

    // DB Row → FovTestResult 변환
    let results: Vec<FovTestResult> = rows
        .into_iter()
        .map(|r| FovTestResult {
            fov_tested: r.fov_tested,
            scenario_type: r.scenario_type,
            score: r.score,
            peripheral_score: r.peripheral_score,
            center_score: r.center_score,
        })
        .collect();

    Ok(compare_fov_results(&results))
}

/// FOV 테스트 결과 삭제 파라미터
#[derive(Deserialize)]
pub struct DeleteFovTestResultsParams {
    pub profile_id: i64,
}

/// FOV 테스트 결과 삭제
#[tauri::command]
pub fn delete_fov_test_results(
    state: State<AppState>,
    params: DeleteFovTestResultsParams,
) -> Result<(), PublicError> {
    validate::id(params.profile_id, "profile_id")?;
    let db = lock_state(&state.db)?;
    db.delete_fov_profiles(params.profile_id)
        .map_err(|e| AppError::Database(e.to_string()).into())
}
