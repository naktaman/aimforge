//! 궤적 분석 Tauri IPC 커맨드

use crate::error::{AppError, PublicError, lock_state};
use crate::validate;
use crate::AppState;
use serde::Deserialize;
use tauri::State;

use super::{analyze_trajectory, extract_click_vectors, ClickEvent, ClickVector, TrajectoryPoint, TrajectoryAnalysisResult};

/// 궤적 분석 요청 파라미터
#[derive(Deserialize)]
pub struct AnalyzeTrajectoryParams {
    pub trial_id: i64,
}

/// 궤적 분석 전체 실행 — 클릭 벡터 + GMM + 감도 진단
#[tauri::command]
pub fn analyze_trajectory_cmd(
    state: State<AppState>,
    params: AnalyzeTrajectoryParams,
) -> Result<TrajectoryAnalysisResult, PublicError> {
    validate::id(params.trial_id, "trial_id")?;
    let db = lock_state(&state.db)?;
    let (trajectory_json, clicks_json, cm360) = db
        .get_trial_trajectory_data(params.trial_id)
        .map_err(|e| AppError::Database(format!("트라이얼 데이터 로드 실패: {}", e)))?;

    analyze_trajectory(&trajectory_json, &clicks_json, cm360)
        .map_err(|e| AppError::Internal(e).into())
}

/// 클릭 벡터만 추출 (경량 엔드포인트)
#[tauri::command]
pub fn get_click_vectors_cmd(
    state: State<AppState>,
    params: AnalyzeTrajectoryParams,
) -> Result<Vec<ClickVector>, PublicError> {
    validate::id(params.trial_id, "trial_id")?;
    let db = lock_state(&state.db)?;
    let (trajectory_json, clicks_json, cm360) = db
        .get_trial_trajectory_data(params.trial_id)
        .map_err(|e| AppError::Database(format!("트라이얼 데이터 로드 실패: {}", e)))?;

    let trajectory: Vec<TrajectoryPoint> =
        serde_json::from_str(&trajectory_json)
            .map_err(|e| AppError::Internal(format!("궤적 파싱 실패: {}", e)))?;
    let clicks: Vec<ClickEvent> =
        serde_json::from_str(&clicks_json)
            .map_err(|e| AppError::Internal(format!("클릭 파싱 실패: {}", e)))?;

    Ok(extract_click_vectors(&trajectory, &clicks, cm360))
}
