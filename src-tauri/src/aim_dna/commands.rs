//! Aim DNA IPC 커맨드 — 배터리 결과 → DNA 산출, 조회, 히스토리

use crate::AppState;
use serde::{Deserialize, Serialize};
use tauri::State;

use super::{compute_aim_dna, AimDnaProfile, BatteryMetricsInput};

/// Aim DNA 산출 요청 파라미터
#[derive(Deserialize)]
pub struct ComputeAimDnaParams {
    pub input: BatteryMetricsInput,
}

/// Aim DNA 산출 — 배터리 메트릭을 받아 26개 피처 계산 후 DB 저장
#[tauri::command]
pub fn compute_aim_dna_cmd(
    state: State<AppState>,
    params: ComputeAimDnaParams,
) -> Result<AimDnaProfile, String> {
    let dna = compute_aim_dna(&params.input);

    // DB 저장
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.insert_aim_dna(&dna).map_err(|e| e.to_string())?;

    // 히스토리 저장
    let pairs = dna.to_feature_pairs();
    db.insert_aim_dna_history_batch(dna.profile_id, &pairs)
        .map_err(|e| e.to_string())?;

    Ok(dna)
}

/// Aim DNA 조회 파라미터
#[derive(Deserialize)]
pub struct GetAimDnaParams {
    pub profile_id: i64,
}

/// 최신 Aim DNA 프로파일 조회
#[tauri::command]
pub fn get_aim_dna(
    state: State<AppState>,
    params: GetAimDnaParams,
) -> Result<Option<AimDnaProfile>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_latest_aim_dna(params.profile_id).map_err(|e| e.to_string())
}

/// Aim DNA 히스토리 조회 파라미터
#[derive(Deserialize)]
pub struct GetAimDnaHistoryParams {
    pub profile_id: i64,
    pub feature_name: Option<String>,
}

/// Aim DNA 히스토리 항목
#[derive(Debug, Clone, Serialize)]
pub struct AimDnaHistoryEntry {
    pub feature_name: String,
    pub value: f64,
    pub measured_at: String,
}

/// Aim DNA 변화 히스토리 조회
#[tauri::command]
pub fn get_aim_dna_history(
    state: State<AppState>,
    params: GetAimDnaHistoryParams,
) -> Result<Vec<AimDnaHistoryEntry>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_aim_dna_history(params.profile_id, params.feature_name.as_deref())
        .map_err(|e| e.to_string())
}

/// 세션 목록 조회 파라미터
#[derive(Deserialize)]
pub struct GetSessionsParams {
    pub profile_id: i64,
    pub limit: Option<i64>,
}

/// 세션 요약 정보
#[derive(Debug, Clone, Serialize)]
pub struct SessionSummary {
    pub id: i64,
    pub mode: String,
    pub session_type: String,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub total_trials: i64,
    pub avg_fps: Option<f64>,
}

/// 세션 히스토리 목록 조회
#[tauri::command]
pub fn get_sessions_history(
    state: State<AppState>,
    params: GetSessionsParams,
) -> Result<Vec<SessionSummary>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_sessions_list(params.profile_id, params.limit.unwrap_or(50))
        .map_err(|e| e.to_string())
}

/// 세션 상세 조회 파라미터
#[derive(Deserialize)]
pub struct GetSessionDetailParams {
    pub session_id: i64,
}

/// 트라이얼 요약
#[derive(Debug, Clone, Serialize)]
pub struct TrialSummary {
    pub id: i64,
    pub scenario_type: String,
    pub cm360_tested: f64,
    pub composite_score: f64,
    pub created_at: String,
}

/// 세션 상세 (트라이얼 포함)
#[derive(Debug, Clone, Serialize)]
pub struct SessionDetail {
    pub session: SessionSummary,
    pub trials: Vec<TrialSummary>,
}

/// 세션 상세 조회
#[tauri::command]
pub fn get_session_detail(
    state: State<AppState>,
    params: GetSessionDetailParams,
) -> Result<SessionDetail, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_session_detail(params.session_id).map_err(|e| e.to_string())
}
