/// DB Tauri IPC 커맨드 — 세션/트라이얼 저장
use crate::AppState;
use serde::Deserialize;
use tauri::State;

/// 세션 시작 요청 파라미터
#[derive(Deserialize)]
pub struct StartSessionParams {
    pub profile_id: i64,
    pub mode: String,
    pub session_type: String,
}

/// 세션 시작 — 세션 ID 반환
#[tauri::command]
pub fn start_session(
    state: State<AppState>,
    params: StartSessionParams,
) -> Result<i64, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.insert_session(params.profile_id, &params.mode, &params.session_type)
        .map_err(|e| e.to_string())
}

/// 트라이얼 저장 요청 파라미터
#[derive(Deserialize)]
pub struct SaveTrialParams {
    pub session_id: i64,
    pub scenario_type: String,
    pub cm360_tested: f64,
    pub composite_score: f64,
    pub raw_metrics: String,
    pub mouse_trajectory: String,
    pub click_events: String,
    pub angle_breakdown: String,
    pub motor_breakdown: String,
}

/// 트라이얼 저장 — 트라이얼 ID 반환
#[tauri::command]
pub fn save_trial(
    state: State<AppState>,
    params: SaveTrialParams,
) -> Result<i64, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.insert_trial(
        params.session_id,
        &params.scenario_type,
        params.cm360_tested,
        params.composite_score,
        &params.raw_metrics,
        &params.mouse_trajectory,
        &params.click_events,
        &params.angle_breakdown,
        &params.motor_breakdown,
    )
    .map_err(|e| e.to_string())
}

/// 세션 종료 요청 파라미터
#[derive(Deserialize)]
pub struct EndSessionParams {
    pub session_id: i64,
    pub total_trials: i64,
    pub avg_fps: f64,
    pub monitor_refresh: i64,
}

/// 세션 종료
#[tauri::command]
pub fn end_session(
    state: State<AppState>,
    params: EndSessionParams,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.update_session_end(
        params.session_id,
        params.total_trials,
        params.avg_fps,
        params.monitor_refresh,
    )
    .map_err(|e| e.to_string())
}
