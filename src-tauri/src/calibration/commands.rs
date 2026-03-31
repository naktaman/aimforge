//! 캘리브레이션 Tauri IPC 커맨드
//! 프론트엔드에서 캘리브레이션 플로우를 제어하는 6개 엔드포인트

use super::{
    CalibrationEngine, CalibrationMode, CalibrationResult, CalibrationStatus, NextTrialAction,
    TrialFeedback,
};
use crate::gp::analysis::ConvergenceMode;
use crate::AppState;
use serde::Deserialize;
use tauri::State;

/// 캘리브레이션 시작 요청 파라미터
#[derive(Debug, Deserialize)]
pub struct StartCalibrationParams {
    pub profile_id: i64,
    pub mode: String,
    pub current_cm360: f64,
    pub game_category: String,
    /// 수렴 모드 (quick/deep/obsessive), 없으면 quick
    pub convergence_mode: Option<String>,
}

/// 트라이얼 제출 파라미터
#[derive(Debug, Deserialize)]
pub struct SubmitTrialParams {
    pub cm360: f64,
    pub score: f64,
    pub metrics_json: Option<String>,
}

/// 캘리브레이션 시작 — CalibrationEngine 생성 + DB 세션 저장
#[tauri::command]
pub fn start_calibration(
    state: State<AppState>,
    params: StartCalibrationParams,
) -> Result<i64, String> {
    let mode = CalibrationMode::from_str(&params.mode);

    // 수렴 모드 파싱 (기본값: Quick)
    let convergence = match params.convergence_mode.as_deref() {
        Some("deep") => ConvergenceMode::Deep,
        Some("obsessive") => ConvergenceMode::Obsessive,
        _ => ConvergenceMode::Quick,
    };

    // CalibrationEngine 생성
    let engine = CalibrationEngine::with_convergence(
        params.current_cm360, mode, &params.game_category, convergence,
    );

    // DB에 세션 기록
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let session_id = db
        .insert_calibration_session(
            params.profile_id,
            &params.mode,
            params.current_cm360,
            &params.game_category,
        )
        .map_err(|e| e.to_string())?;

    // GP 모델 기록
    db.insert_gp_model(session_id, 5.0, 0.1, 0.015, None, None)
        .map_err(|e| e.to_string())?;

    drop(db); // DB lock 해제 후 calibration lock

    // 엔진 저장
    let mut cal = state.calibration.lock().map_err(|e| e.to_string())?;
    *cal = Some(engine);

    Ok(session_id)
}

/// 다음 테스트할 cm/360 조회
#[tauri::command]
pub fn get_next_trial_sens(state: State<AppState>) -> Result<NextTrialAction, String> {
    let cal = state.calibration.lock().map_err(|e| e.to_string())?;
    let engine = cal.as_ref().ok_or("캘리브레이션이 시작되지 않음")?;
    Ok(engine.get_next_sens())
}

/// 트라이얼 결과 제출
#[tauri::command]
pub fn submit_calibration_trial(
    state: State<AppState>,
    params: SubmitTrialParams,
) -> Result<TrialFeedback, String> {
    // 메트릭 파싱 (있으면)
    let metrics = params
        .metrics_json
        .as_deref()
        .and_then(|json| serde_json::from_str(json).ok());

    let mut cal = state.calibration.lock().map_err(|e| e.to_string())?;
    let engine = cal.as_mut().ok_or("캘리브레이션이 시작되지 않음")?;

    Ok(engine.submit_trial(params.cm360, params.score, metrics))
}

/// 현재 캘리브레이션 상태 조회
#[tauri::command]
pub fn get_calibration_status(state: State<AppState>) -> Result<CalibrationStatus, String> {
    let cal = state.calibration.lock().map_err(|e| e.to_string())?;
    let engine = cal.as_ref().ok_or("캘리브레이션이 시작되지 않음")?;
    Ok(engine.get_status())
}

/// 캘리브레이션 최종 결과 생성 + DB 저장
#[tauri::command]
pub fn finalize_calibration(state: State<AppState>) -> Result<CalibrationResult, String> {
    let cal = state.calibration.lock().map_err(|e| e.to_string())?;
    let engine = cal.as_ref().ok_or("캘리브레이션이 시작되지 않음")?;

    let result = engine.finalize();

    // TODO: DB에 결과 저장 (calibration_session_id 필요)
    // 현재는 결과만 반환

    Ok(result)
}

/// 캘리브레이션 취소
#[tauri::command]
pub fn cancel_calibration(state: State<AppState>) -> Result<(), String> {
    let mut cal = state.calibration.lock().map_err(|e| e.to_string())?;
    *cal = None;
    Ok(())
}
