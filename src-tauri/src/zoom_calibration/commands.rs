//! 줌 캘리브레이션 IPC 커맨드 — 프론트엔드↔백엔드 인터페이스

use crate::db::ZoomProfileRow;
use crate::error::{AppError, PublicError, lock_state};
use crate::validate;
use crate::AppState;
use serde::Deserialize;
use tauri::State;

use super::comparator::{ComparatorEngine, ComparatorTrialData, ComparatorTrialFeedback, ComparatorResult};
use super::{
    AdjustedPredictions, ZoomCalibrationEngine, ZoomCalibrationMode, ZoomCalibrationResult,
    ZoomCalibrationStatus, ZoomPhase, ZoomPhaseWeights, ZoomProfileInfo, ZoomTrialAction,
    ZoomTrialFeedback,
};
use crate::gp::ConvergenceMode;

/// 줌 캘리브레이션 시작 파라미터
#[derive(Debug, Deserialize)]
pub struct StartZoomCalibrationParams {
    pub profile_id: i64,
    pub game_id: i64,
    pub hipfire_fov: f64,
    pub base_cm360: f64,
    /// 선택된 줌 프로파일 ID 목록 (캘리브레이션 대상)
    pub selected_profile_ids: Vec<i64>,
    /// 수렴 모드 ("quick" | "deep" | "obsessive")
    pub convergence_mode: Option<String>,
    /// 캘리브레이션 모드 ("light" | "standard" | "deep")
    pub calibration_mode: Option<String>,
}

/// 트라이얼 제출 파라미터
#[derive(Debug, Deserialize)]
pub struct SubmitZoomTrialParams {
    /// 현재 페이즈 ("steady" | "correction" | "zoomout")
    pub phase: String,
    /// 점수 (0~1 정규화)
    pub score: f64,
}

/// 비교기 시작 파라미터
#[derive(Debug, Deserialize)]
pub struct StartComparatorParams {
    pub profile_id: i64,
    pub zoom_profile_id: i64,
    /// 방식별 배율 목록 (6개)
    pub multipliers: Vec<f64>,
}

/// 비교기 트라이얼 제출 파라미터
#[derive(Debug, Deserialize)]
pub struct SubmitComparatorParams {
    pub steady_score: f64,
    pub correction_score: f64,
    pub zoomout_score: f64,
    pub composite_score: f64,
}

/// 랜드스케이프 저장 파라미터
#[derive(Debug, Deserialize)]
pub struct SaveLandscapeParams {
    pub profile_id: i64,
    pub calibration_session_id: Option<i64>,
    pub gp_mean_curve: String,
    pub confidence_bands: String,
    pub scenario_overlays: String,
    pub bimodal_peaks: String,
}

// ── 줌 프로파일 조회 ──

/// 게임의 줌 프로파일 목록 조회
#[tauri::command]
pub fn get_zoom_profiles(
    state: State<'_, AppState>,
    game_id: i64,
) -> Result<Vec<ZoomProfileRow>, PublicError> {
    validate::id(game_id, "game_id")?;
    let db = lock_state(&state.db)?;
    db.get_zoom_profiles(game_id).map_err(|e| AppError::Database(e.to_string()).into())
}

// ── 줌 캘리브레이션 ──

/// 줌 캘리브레이션 시작
#[tauri::command]
pub fn start_zoom_calibration(
    state: State<'_, AppState>,
    params: StartZoomCalibrationParams,
) -> Result<(), PublicError> {
    // 입력값 검증
    validate::id(params.profile_id, "profile_id")?;
    validate::id(params.game_id, "game_id")?;
    validate::fov(params.hipfire_fov)?;
    validate::cm360(params.base_cm360)?;

    let db = lock_state(&state.db)?;

    // DB에서 전체 줌 프로파일 로드
    let all_rows = db
        .get_zoom_profiles(params.game_id)
        .map_err(|e| AppError::Database(e.to_string()))?;

    // ZoomProfileInfo로 변환
    let all_profiles: Vec<ZoomProfileInfo> = all_rows
        .iter()
        .map(|r| row_to_profile_info(r, params.hipfire_fov))
        .collect();

    // 선택된 프로파일 필터
    let selected_profiles: Vec<ZoomProfileInfo> = all_profiles
        .iter()
        .filter(|p| params.selected_profile_ids.contains(&p.id))
        .cloned()
        .collect();

    if selected_profiles.is_empty() {
        return Err(AppError::Validation("선택된 줌 프로파일이 없습니다".to_string()).into());
    }

    // 수렴 모드 파싱
    let mode = match params.convergence_mode.as_deref() {
        Some("deep") => ConvergenceMode::Deep,
        Some("obsessive") => ConvergenceMode::Obsessive,
        _ => ConvergenceMode::Quick,
    };

    // 캘리브레이션 모드 파싱 (Light/Standard/Deep)
    let cal_mode = match params.calibration_mode.as_deref() {
        Some("standard") => ZoomCalibrationMode::Standard,
        Some("deep") => ZoomCalibrationMode::Deep,
        _ => ZoomCalibrationMode::Light,
    };

    let engine = ZoomCalibrationEngine::new_with_mode(
        params.profile_id,
        params.base_cm360,
        params.hipfire_fov,
        selected_profiles,
        all_profiles,
        mode,
        cal_mode,
    );

    drop(db);
    let mut zoom_cal = lock_state(&state.zoom_calibration)?;
    *zoom_cal = Some(engine);

    Ok(())
}

/// 다음 줌 트라이얼 조회
#[tauri::command]
pub fn get_next_zoom_trial(
    state: State<'_, AppState>,
) -> Result<Option<ZoomTrialAction>, PublicError> {
    let zoom_cal = lock_state(&state.zoom_calibration)?;
    match zoom_cal.as_ref() {
        Some(engine) => Ok(engine.get_next_trial()),
        None => Err(AppError::NotFound("줌 캘리브레이션이 시작되지 않았습니다".to_string()).into()),
    }
}

/// 줌 트라이얼 결과 제출
#[tauri::command]
pub fn submit_zoom_trial(
    state: State<'_, AppState>,
    params: SubmitZoomTrialParams,
) -> Result<ZoomTrialFeedback, PublicError> {
    // 입력값 검증
    validate::score(params.score)?;
    validate::non_empty_str(&params.phase, "phase")?;

    let mut zoom_cal = lock_state(&state.zoom_calibration)?;
    let engine = zoom_cal
        .as_mut()
        .ok_or_else(|| AppError::NotFound("줌 캘리브레이션이 시작되지 않았습니다".to_string()))?;

    let phase = match params.phase.as_str() {
        "steady" => ZoomPhase::Steady,
        "correction" => ZoomPhase::Correction,
        "zoomout" => ZoomPhase::Zoomout,
        _ => return Err(AppError::Validation(format!("알 수 없는 페이즈: {}", params.phase)).into()),
    };

    Ok(engine.submit_trial(phase, params.score))
}

/// 줌 캘리브레이션 최종 결과 생성
#[tauri::command]
pub fn finalize_zoom_calibration(
    state: State<'_, AppState>,
) -> Result<ZoomCalibrationResult, PublicError> {
    let mut zoom_cal = lock_state(&state.zoom_calibration)?;
    let engine = zoom_cal
        .as_mut()
        .ok_or_else(|| AppError::NotFound("줌 캘리브레이션이 시작되지 않았습니다".to_string()))?;

    let result = engine.finalize();

    // DB에 결과 저장
    let db = lock_state(&state.db)?;
    for rr in &result.ratio_results {
        db.insert_zoom_calibration(
            engine.profile_id,
            rr.zoom_profile_id,
            rr.optimal_multiplier,
            Some(rr.steady_score),
            Some(rr.correction_score),
            Some(rr.zoomout_score),
            rr.composite_score,
            None,
            Some(rr.mdm_predicted),
            Some(rr.optimal_multiplier),
            Some(rr.deviation),
        )
        .map_err(|e| AppError::Database(e.to_string()))?;
    }

    // K 값 저장
    let data_points_json = serde_json::to_string(&result.k_fit.data_points)
        .map_err(|e| AppError::Internal(e.to_string()))?;
    db.insert_multiplier_curve(
        engine.profile_id,
        result.k_fit.k_value,
        Some(result.k_fit.k_variance),
        &data_points_json,
    )
    .map_err(|e| AppError::Database(e.to_string()))?;

    // 프로파일 k_value 업데이트
    db.update_profile_k_value(engine.profile_id, result.k_fit.k_value)
        .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(result)
}

/// K 값 수동 조정
#[tauri::command]
pub fn adjust_k(
    state: State<'_, AppState>,
    delta: f64,
) -> Result<AdjustedPredictions, PublicError> {
    validate::k_delta(delta)?;

    let mut zoom_cal = lock_state(&state.zoom_calibration)?;
    let engine = zoom_cal
        .as_mut()
        .ok_or_else(|| AppError::NotFound("줌 캘리브레이션이 시작되지 않았습니다".to_string()))?;

    Ok(engine.adjust_k(delta))
}

/// 줌 캘리브레이션 상태 조회
#[tauri::command]
pub fn get_zoom_calibration_status(
    state: State<'_, AppState>,
) -> Result<ZoomCalibrationStatus, PublicError> {
    let zoom_cal = lock_state(&state.zoom_calibration)?;
    match zoom_cal.as_ref() {
        Some(engine) => Ok(engine.get_status()),
        None => Err(AppError::NotFound("줌 캘리브레이션이 시작되지 않았습니다".to_string()).into()),
    }
}

// ── 비교기 ──

/// 변환 방식 비교기 시작
#[tauri::command]
pub fn start_comparator(
    state: State<'_, AppState>,
    params: StartComparatorParams,
) -> Result<(), PublicError> {
    validate::id(params.profile_id, "profile_id")?;
    validate::id(params.zoom_profile_id, "zoom_profile_id")?;
    validate::multipliers(&params.multipliers)?;

    let engine = ComparatorEngine::new(params.profile_id, params.zoom_profile_id, 3, params.multipliers.clone());
    let mut comp = lock_state(&state.comparator)?;
    *comp = Some(engine);
    Ok(())
}

/// 비교기 다음 트라이얼
#[tauri::command]
pub fn get_next_comparator_trial(
    state: State<'_, AppState>,
    multipliers: Vec<f64>,
) -> Result<Option<super::comparator::ComparatorTrialAction>, PublicError> {
    let comp = lock_state(&state.comparator)?;
    match comp.as_ref() {
        Some(engine) => Ok(engine.get_next_trial(&multipliers)),
        None => Err(AppError::NotFound("비교기가 시작되지 않았습니다".to_string()).into()),
    }
}

/// 비교기 트라이얼 결과 제출
#[tauri::command]
pub fn submit_comparator_trial(
    state: State<'_, AppState>,
    params: SubmitComparatorParams,
) -> Result<ComparatorTrialFeedback, PublicError> {
    // 입력값 검증
    validate::score(params.steady_score)?;
    validate::score(params.correction_score)?;
    validate::score(params.zoomout_score)?;
    validate::score(params.composite_score)?;

    let mut comp = lock_state(&state.comparator)?;
    let engine = comp
        .as_mut()
        .ok_or_else(|| AppError::NotFound("비교기가 시작되지 않았습니다".to_string()))?;

    let data = ComparatorTrialData {
        steady_score: params.steady_score,
        correction_score: params.correction_score,
        zoomout_score: params.zoomout_score,
        composite_score: params.composite_score,
    };

    Ok(engine.submit_trial(data))
}

/// 비교기 최종 결과
#[tauri::command]
pub fn finalize_comparator(
    state: State<'_, AppState>,
) -> Result<ComparatorResult, PublicError> {
    let comp = lock_state(&state.comparator)?;
    let engine = comp
        .as_ref()
        .ok_or_else(|| AppError::NotFound("비교기가 시작되지 않았습니다".to_string()))?;

    if !engine.is_complete() {
        return Err(AppError::Validation("아직 모든 트라이얼이 완료되지 않았습니다".to_string()).into());
    }

    let result = engine.finalize();

    // DB에 결과 저장
    let db = lock_state(&state.db)?;
    for ms in &result.method_scores {
        db.insert_conversion_comparison(
            engine.profile_id,
            engine.zoom_profile_id,
            &ms.method,
            ms.multiplier_used,
            Some(ms.steady_mean),
            Some(ms.correction_mean),
            Some(ms.zoomout_mean),
            ms.composite_mean,
            ms.p_value,
            ms.effect_size,
            Some(ms.rank as i64),
        )
        .map_err(|e| AppError::Database(e.to_string()))?;
    }

    Ok(result)
}

// ── 랜드스케이프 ──

/// Performance Landscape 저장
#[tauri::command]
pub fn save_landscape(
    state: State<'_, AppState>,
    params: SaveLandscapeParams,
) -> Result<i64, PublicError> {
    validate::id(params.profile_id, "profile_id")?;
    validate::non_empty_str(&params.gp_mean_curve, "gp_mean_curve")?;

    let db = lock_state(&state.db)?;
    db.insert_performance_landscape(
        params.profile_id,
        params.calibration_session_id,
        &params.gp_mean_curve,
        &params.confidence_bands,
        &params.scenario_overlays,
        &params.bimodal_peaks,
    )
    .map_err(|e| AppError::Database(e.to_string()).into())
}

// ── 헬퍼 ──

/// DB 행을 ZoomProfileInfo로 변환
fn row_to_profile_info(row: &ZoomProfileRow, hipfire_fov: f64) -> ZoomProfileInfo {
    // FOV 오버라이드가 있으면 사용, 없으면 비율로 계산
    let scope_fov = row.fov_override.unwrap_or_else(|| {
        // 근사: scope_fov = hipfire_fov / zoom_ratio
        let hip_rad = hipfire_fov.to_radians() / 2.0;
        let scope_half = (hip_rad.tan() / row.zoom_ratio).atan();
        (scope_half * 2.0).to_degrees()
    });

    ZoomProfileInfo {
        id: row.id,
        scope_name: row.scope_name.clone(),
        zoom_ratio: row.zoom_ratio,
        fov_override: row.fov_override,
        scope_fov,
        weights: ZoomPhaseWeights {
            steady: row.steady_weight,
            correction: row.transition_weight,
            zoomout: row.zoomout_weight,
        },
    }
}
