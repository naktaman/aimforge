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

// ═══════════════════════════════════════════════════
// Phase 5: 신규 커맨드
// ═══════════════════════════════════════════════════

/// 크래시 로그 저장 파라미터
#[derive(Deserialize)]
pub struct LogCrashParams {
    pub error_type: String,
    pub error_message: String,
    pub stack_trace: Option<String>,
    pub context: String,
    pub app_version: String,
}

/// 크래시 로그 로컬 저장
#[tauri::command]
pub fn log_crash(
    state: State<AppState>,
    params: LogCrashParams,
) -> Result<i64, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.insert_crash_log(
        &params.error_type,
        &params.error_message,
        params.stack_trace.as_deref(),
        &params.context,
        &params.app_version,
    )
    .map_err(|e| e.to_string())
}

/// 크래시 로그 조회
#[tauri::command]
pub fn get_crash_logs(
    state: State<AppState>,
    limit: Option<i64>,
) -> Result<Vec<super::CrashLogRow>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_crash_logs(limit.unwrap_or(50)).map_err(|e| e.to_string())
}

/// 일별 통계 조회
#[tauri::command]
pub fn get_daily_stats(
    state: State<AppState>,
    profile_id: i64,
    days: Option<i64>,
) -> Result<Vec<super::DailyStatRow>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_daily_stats(profile_id, days.unwrap_or(30)).map_err(|e| e.to_string())
}

/// 스킬 진행도 조회
#[tauri::command]
pub fn get_skill_progress(
    state: State<AppState>,
    profile_id: i64,
) -> Result<Vec<super::SkillProgressRow>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_skill_progress(profile_id).map_err(|e| e.to_string())
}

/// 사용자 설정 저장
#[tauri::command]
pub fn save_user_setting(
    state: State<AppState>,
    profile_id: i64,
    key: String,
    value: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.save_setting(profile_id, &key, &value).map_err(|e| e.to_string())
}

/// 사용자 설정 조회
#[tauri::command]
pub fn get_user_setting(
    state: State<AppState>,
    profile_id: i64,
    key: String,
) -> Result<Option<String>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_setting(profile_id, &key).map_err(|e| e.to_string())
}

/// 모든 사용자 설정 조회
#[tauri::command]
pub fn get_all_user_settings(
    state: State<AppState>,
    profile_id: i64,
) -> Result<Vec<(String, String)>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_all_settings(profile_id).map_err(|e| e.to_string())
}

/// 게임 프로필 생성 파라미터
#[derive(Deserialize)]
pub struct CreateGameProfileParams {
    pub profile_id: i64,
    pub game_id: String,
    pub game_name: String,
    pub custom_sens: f64,
    pub custom_dpi: i64,
    pub custom_fov: f64,
    pub custom_cm360: f64,
    pub keybinds_json: String,
}

/// 게임 프로필 생성
#[tauri::command]
pub fn create_game_profile(
    state: State<AppState>,
    params: CreateGameProfileParams,
) -> Result<i64, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.insert_game_profile(
        params.profile_id, &params.game_id, &params.game_name,
        params.custom_sens, params.custom_dpi, params.custom_fov,
        params.custom_cm360, &params.keybinds_json,
    ).map_err(|e| e.to_string())
}

/// 게임 프로필 목록 조회
#[tauri::command]
pub fn get_game_profiles(
    state: State<AppState>,
    profile_id: i64,
) -> Result<Vec<super::GameProfileRow>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_game_profiles(profile_id).map_err(|e| e.to_string())
}

/// 게임 프로필 업데이트 파라미터
#[derive(Deserialize)]
pub struct UpdateGameProfileParams {
    pub id: i64,
    pub custom_sens: f64,
    pub custom_dpi: i64,
    pub custom_fov: f64,
    pub custom_cm360: f64,
    pub keybinds_json: String,
}

/// 게임 프로필 업데이트
#[tauri::command]
pub fn update_game_profile(
    state: State<AppState>,
    params: UpdateGameProfileParams,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.update_game_profile(
        params.id, params.custom_sens, params.custom_dpi,
        params.custom_fov, params.custom_cm360, &params.keybinds_json,
    ).map_err(|e| e.to_string())
}

/// 게임 프로필 삭제
#[tauri::command]
pub fn delete_game_profile(
    state: State<AppState>,
    id: i64,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.delete_game_profile(id).map_err(|e| e.to_string())
}

/// 활성 게임 프로필 설정
#[tauri::command]
pub fn set_active_game_profile(
    state: State<AppState>,
    profile_id: i64,
    game_profile_id: i64,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.set_active_game_profile(profile_id, game_profile_id).map_err(|e| e.to_string())
}

/// 루틴 생성
#[tauri::command]
pub fn create_routine(
    state: State<AppState>,
    profile_id: i64,
    name: String,
    description: String,
) -> Result<i64, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.insert_routine(profile_id, &name, &description).map_err(|e| e.to_string())
}

/// 루틴 목록 조회
#[tauri::command]
pub fn get_routines(
    state: State<AppState>,
    profile_id: i64,
) -> Result<Vec<super::RoutineRow>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_routines(profile_id).map_err(|e| e.to_string())
}

/// 루틴 삭제
#[tauri::command]
pub fn delete_routine(
    state: State<AppState>,
    id: i64,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.delete_routine(id).map_err(|e| e.to_string())
}

/// 루틴 스텝 추가 파라미터
#[derive(Deserialize)]
pub struct AddRoutineStepParams {
    pub routine_id: i64,
    pub step_order: i64,
    pub stage_type: String,
    pub duration_ms: i64,
    pub config_json: String,
}

/// 루틴 스텝 추가
#[tauri::command]
pub fn add_routine_step(
    state: State<AppState>,
    params: AddRoutineStepParams,
) -> Result<i64, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let id = db.insert_routine_step(
        params.routine_id, params.step_order, &params.stage_type,
        params.duration_ms, &params.config_json,
    ).map_err(|e| e.to_string())?;
    db.update_routine_duration(params.routine_id).map_err(|e| e.to_string())?;
    Ok(id)
}

/// 루틴 스텝 목록 조회
#[tauri::command]
pub fn get_routine_steps(
    state: State<AppState>,
    routine_id: i64,
) -> Result<Vec<super::RoutineStepRow>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_routine_steps(routine_id).map_err(|e| e.to_string())
}

/// 루틴 스텝 삭제
#[tauri::command]
pub fn remove_routine_step(
    state: State<AppState>,
    id: i64,
    routine_id: i64,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.delete_routine_step(id).map_err(|e| e.to_string())?;
    db.update_routine_duration(routine_id).map_err(|e| e.to_string())?;
    Ok(())
}

/// 루틴 스텝 순서 교환
#[tauri::command]
pub fn swap_routine_step_order(
    state: State<AppState>,
    step_id_a: i64,
    step_id_b: i64,
    routine_id: i64,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.swap_routine_step_order(step_id_a, step_id_b).map_err(|e| e.to_string())?;
    db.update_routine_duration(routine_id).map_err(|e| e.to_string())?;
    Ok(())
}

/// DB 내보내기 — DB 파일 경로 반환
#[tauri::command]
pub fn export_database(
    state: State<AppState>,
) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_db_path().map_err(|e| e.to_string())
}
