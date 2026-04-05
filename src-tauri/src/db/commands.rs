/// DB Tauri IPC 커맨드 — 세션/트라이얼 저장
use crate::error::{AppError, PublicError, lock_state};
use crate::validate;
use crate::AppState;
use serde::Deserialize;
use tauri::State;

/// 세션 시작 요청 파라미터
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
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
) -> Result<i64, PublicError> {
    validate::id(params.profile_id, "profile_id")?;
    validate::non_empty_str(&params.mode, "mode")?;
    validate::non_empty_str(&params.session_type, "session_type")?;

    let db = lock_state(&state.db)?;
    db.insert_session(params.profile_id, &params.mode, &params.session_type)
        .map_err(|e| AppError::Database(e.to_string()).into())
}

/// 트라이얼 저장 요청 파라미터
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
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
) -> Result<i64, PublicError> {
    validate::id(params.session_id, "session_id")?;
    validate::non_empty_str(&params.scenario_type, "scenario_type")?;
    validate::cm360(params.cm360_tested)?;

    let db = lock_state(&state.db)?;
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
    .map_err(|e| AppError::Database(e.to_string()).into())
}

/// 세션 종료 요청 파라미터
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
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
) -> Result<(), PublicError> {
    validate::id(params.session_id, "session_id")?;

    let db = lock_state(&state.db)?;
    db.update_session_end(
        params.session_id,
        params.total_trials,
        params.avg_fps,
        params.monitor_refresh,
    )
    .map_err(|e| AppError::Database(e.to_string()).into())
}

// ═══════════════════════════════════════════════════
// Phase 5: 신규 커맨드
// ═══════════════════════════════════════════════════

/// 크래시 로그 저장 파라미터
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
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
) -> Result<i64, PublicError> {
    validate::non_empty_str(&params.error_type, "error_type")?;
    validate::non_empty_str(&params.error_message, "error_message")?;

    let db = lock_state(&state.db)?;
    db.insert_crash_log(
        &params.error_type,
        &params.error_message,
        params.stack_trace.as_deref(),
        &params.context,
        &params.app_version,
    )
    .map_err(|e| AppError::Database(e.to_string()).into())
}

/// 크래시 로그 조회
#[tauri::command]
pub fn get_crash_logs(
    state: State<AppState>,
    limit: Option<i64>,
) -> Result<Vec<super::CrashLogRow>, PublicError> {
    let db = lock_state(&state.db)?;
    db.get_crash_logs(limit.unwrap_or(50))
        .map_err(|e| AppError::Database(e.to_string()).into())
}

/// 일별 통계 조회
#[tauri::command]
pub fn get_daily_stats(
    state: State<AppState>,
    profile_id: i64,
    days: Option<i64>,
) -> Result<Vec<super::DailyStatRow>, PublicError> {
    validate::id(profile_id, "profile_id")?;
    let db = lock_state(&state.db)?;
    db.get_daily_stats(profile_id, days.unwrap_or(30))
        .map_err(|e| AppError::Database(e.to_string()).into())
}

/// 스킬 진행도 조회
#[tauri::command]
pub fn get_skill_progress(
    state: State<AppState>,
    profile_id: i64,
) -> Result<Vec<super::SkillProgressRow>, PublicError> {
    validate::id(profile_id, "profile_id")?;
    let db = lock_state(&state.db)?;
    db.get_skill_progress(profile_id)
        .map_err(|e| AppError::Database(e.to_string()).into())
}

/// 사용자 설정 저장
#[tauri::command]
pub fn save_user_setting(
    state: State<AppState>,
    profile_id: i64,
    key: String,
    value: String,
) -> Result<(), PublicError> {
    validate::id(profile_id, "profile_id")?;
    validate::non_empty_str(&key, "key")?;

    let db = lock_state(&state.db)?;
    db.save_setting(profile_id, &key, &value)
        .map_err(|e| AppError::Database(e.to_string()).into())
}

/// 사용자 설정 조회
#[tauri::command]
pub fn get_user_setting(
    state: State<AppState>,
    profile_id: i64,
    key: String,
) -> Result<Option<String>, PublicError> {
    validate::id(profile_id, "profile_id")?;
    validate::non_empty_str(&key, "key")?;

    let db = lock_state(&state.db)?;
    db.get_setting(profile_id, &key)
        .map_err(|e| AppError::Database(e.to_string()).into())
}

/// 모든 사용자 설정 조회
#[tauri::command]
pub fn get_all_user_settings(
    state: State<AppState>,
    profile_id: i64,
) -> Result<Vec<(String, String)>, PublicError> {
    validate::id(profile_id, "profile_id")?;
    let db = lock_state(&state.db)?;
    db.get_all_settings(profile_id)
        .map_err(|e| AppError::Database(e.to_string()).into())
}

/// 게임 프로필 생성 파라미터
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
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
) -> Result<i64, PublicError> {
    validate::id(params.profile_id, "profile_id")?;
    validate::non_empty_str(&params.game_id, "game_id")?;
    validate::non_empty_str(&params.game_name, "game_name")?;
    validate::sensitivity(params.custom_sens)?;
    validate::dpi_i64(params.custom_dpi)?;
    validate::fov(params.custom_fov)?;
    validate::cm360(params.custom_cm360)?;

    let db = lock_state(&state.db)?;
    db.insert_game_profile(
        params.profile_id, &params.game_id, &params.game_name,
        params.custom_sens, params.custom_dpi, params.custom_fov,
        params.custom_cm360, &params.keybinds_json,
    ).map_err(|e| AppError::Database(e.to_string()).into())
}

/// 게임 프로필 목록 조회
#[tauri::command]
pub fn get_game_profiles(
    state: State<AppState>,
    profile_id: i64,
) -> Result<Vec<super::GameProfileRow>, PublicError> {
    validate::id(profile_id, "profile_id")?;
    let db = lock_state(&state.db)?;
    db.get_game_profiles(profile_id)
        .map_err(|e| AppError::Database(e.to_string()).into())
}

/// 게임 프로필 업데이트 파라미터
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
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
) -> Result<(), PublicError> {
    validate::id(params.id, "id")?;
    validate::sensitivity(params.custom_sens)?;
    validate::dpi_i64(params.custom_dpi)?;
    validate::fov(params.custom_fov)?;
    validate::cm360(params.custom_cm360)?;

    let db = lock_state(&state.db)?;
    db.update_game_profile(
        params.id, params.custom_sens, params.custom_dpi,
        params.custom_fov, params.custom_cm360, &params.keybinds_json,
    ).map_err(|e| AppError::Database(e.to_string()).into())
}

/// 게임 프로필 삭제
#[tauri::command]
pub fn delete_game_profile(
    state: State<AppState>,
    id: i64,
) -> Result<(), PublicError> {
    validate::id(id, "id")?;
    let db = lock_state(&state.db)?;
    db.delete_game_profile(id)
        .map_err(|e| AppError::Database(e.to_string()).into())
}

/// 활성 게임 프로필 설정
#[tauri::command]
pub fn set_active_game_profile(
    state: State<AppState>,
    profile_id: i64,
    game_profile_id: i64,
) -> Result<(), PublicError> {
    validate::id(profile_id, "profile_id")?;
    validate::id(game_profile_id, "game_profile_id")?;

    let db = lock_state(&state.db)?;
    db.set_active_game_profile(profile_id, game_profile_id)
        .map_err(|e| AppError::Database(e.to_string()).into())
}

/// 루틴 생성
#[tauri::command]
pub fn create_routine(
    state: State<AppState>,
    profile_id: i64,
    name: String,
    description: String,
) -> Result<i64, PublicError> {
    validate::id(profile_id, "profile_id")?;
    validate::non_empty_str(&name, "name")?;

    let db = lock_state(&state.db)?;
    db.insert_routine(profile_id, &name, &description)
        .map_err(|e| AppError::Database(e.to_string()).into())
}

/// 루틴 목록 조회
#[tauri::command]
pub fn get_routines(
    state: State<AppState>,
    profile_id: i64,
) -> Result<Vec<super::RoutineRow>, PublicError> {
    validate::id(profile_id, "profile_id")?;
    let db = lock_state(&state.db)?;
    db.get_routines(profile_id)
        .map_err(|e| AppError::Database(e.to_string()).into())
}

/// 루틴 삭제
#[tauri::command]
pub fn delete_routine(
    state: State<AppState>,
    id: i64,
) -> Result<(), PublicError> {
    validate::id(id, "id")?;
    let db = lock_state(&state.db)?;
    db.delete_routine(id)
        .map_err(|e| AppError::Database(e.to_string()).into())
}

/// 루틴 스텝 추가 파라미터
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
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
) -> Result<i64, PublicError> {
    validate::id(params.routine_id, "routine_id")?;
    validate::non_empty_str(&params.stage_type, "stage_type")?;

    let db = lock_state(&state.db)?;
    let id = db.insert_routine_step(
        params.routine_id, params.step_order, &params.stage_type,
        params.duration_ms, &params.config_json,
    ).map_err(|e| AppError::Database(e.to_string()))?;
    db.update_routine_duration(params.routine_id)
        .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(id)
}

/// 루틴 스텝 목록 조회
#[tauri::command]
pub fn get_routine_steps(
    state: State<AppState>,
    routine_id: i64,
) -> Result<Vec<super::RoutineStepRow>, PublicError> {
    validate::id(routine_id, "routine_id")?;
    let db = lock_state(&state.db)?;
    db.get_routine_steps(routine_id)
        .map_err(|e| AppError::Database(e.to_string()).into())
}

/// 루틴 스텝 삭제
#[tauri::command]
pub fn remove_routine_step(
    state: State<AppState>,
    id: i64,
    routine_id: i64,
) -> Result<(), PublicError> {
    validate::id(id, "id")?;
    validate::id(routine_id, "routine_id")?;

    let db = lock_state(&state.db)?;
    db.delete_routine_step(id)
        .map_err(|e| AppError::Database(e.to_string()))?;
    db.update_routine_duration(routine_id)
        .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(())
}

/// 루틴 스텝 순서 교환
#[tauri::command]
pub fn swap_routine_step_order(
    state: State<AppState>,
    step_id_a: i64,
    step_id_b: i64,
    routine_id: i64,
) -> Result<(), PublicError> {
    validate::id(step_id_a, "step_id_a")?;
    validate::id(step_id_b, "step_id_b")?;
    validate::id(routine_id, "routine_id")?;

    let db = lock_state(&state.db)?;
    db.swap_routine_step_order(step_id_a, step_id_b)
        .map_err(|e| AppError::Database(e.to_string()))?;
    db.update_routine_duration(routine_id)
        .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(())
}

/// DB 내보내기 — DB 파일 경로 반환
#[tauri::command]
pub fn export_database(
    state: State<AppState>,
) -> Result<String, PublicError> {
    let db = lock_state(&state.db)?;
    db.get_db_path()
        .map_err(|e| AppError::Database(e.to_string()).into())
}

// ═══════════════════════════════════════════════════
// 주별 통계 + 아카이브 + DB 최적화
// ═══════════════════════════════════════════════════

/// 주별 통계 조회 (weekly_stats 뷰 활용)
#[tauri::command]
pub fn get_weekly_stats(
    state: State<AppState>,
    profile_id: i64,
    weeks: Option<i64>,
) -> Result<Vec<super::WeeklyStatRow>, PublicError> {
    validate::id(profile_id, "profile_id")?;
    let db = lock_state(&state.db)?;
    db.get_weekly_stats(profile_id, weeks.unwrap_or(12))
        .map_err(|e| AppError::Database(e.to_string()).into())
}

/// 오래된 트라이얼 raw 데이터 아카이브 (경량화)
/// days_old일 이전의 mouse_trajectory, raw_metrics를 비움
#[tauri::command]
pub fn archive_old_trials(
    state: State<AppState>,
    days_old: Option<i64>,
) -> Result<usize, PublicError> {
    let db = lock_state(&state.db)?;
    db.archive_old_trials(days_old.unwrap_or(90))
        .map_err(|e| AppError::Database(e.to_string()).into())
}

/// DB 최적화 (ANALYZE + optimize)
#[tauri::command]
pub fn optimize_database(
    state: State<AppState>,
) -> Result<(), PublicError> {
    let db = lock_state(&state.db)?;
    db.optimize_db()
        .map_err(|e| AppError::Database(e.to_string()).into())
}
