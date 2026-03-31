//! 줌 캘리브레이션 IPC 커맨드 — 프론트엔드↔백엔드 인터페이스

use crate::db::ZoomProfileRow;
use crate::AppState;
use serde::{Deserialize, Serialize};
use tauri::State;

use super::comparator::{ComparatorEngine, ComparatorTrialData, ComparatorTrialFeedback, ComparatorResult};
use super::{
    AdjustedPredictions, ZoomCalibrationEngine, ZoomCalibrationResult, ZoomCalibrationStatus,
    ZoomPhase, ZoomPhaseWeights, ZoomProfileInfo, ZoomTrialAction, ZoomTrialFeedback,
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
) -> Result<Vec<ZoomProfileRow>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_zoom_profiles(game_id).map_err(|e| e.to_string())
}

// ── 줌 캘리브레이션 ──

/// 줌 캘리브레이션 시작
#[tauri::command]
pub fn start_zoom_calibration(
    state: State<'_, AppState>,
    params: StartZoomCalibrationParams,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    // DB에서 전체 줌 프로파일 로드
    let all_rows = db
        .get_zoom_profiles(params.game_id)
        .map_err(|e| e.to_string())?;

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
        return Err("선택된 줌 프로파일이 없습니다".to_string());
    }

    // 수렴 모드 파싱
    let mode = match params.convergence_mode.as_deref() {
        Some("deep") => ConvergenceMode::Deep,
        Some("obsessive") => ConvergenceMode::Obsessive,
        _ => ConvergenceMode::Quick,
    };

    let engine = ZoomCalibrationEngine::new(
        params.profile_id,
        params.base_cm360,
        params.hipfire_fov,
        selected_profiles,
        all_profiles,
        mode,
    );

    let mut zoom_cal = state.zoom_calibration.lock().map_err(|e| e.to_string())?;
    *zoom_cal = Some(engine);

    Ok(())
}

/// 다음 줌 트라이얼 조회
#[tauri::command]
pub fn get_next_zoom_trial(
    state: State<'_, AppState>,
) -> Result<Option<ZoomTrialAction>, String> {
    let zoom_cal = state.zoom_calibration.lock().map_err(|e| e.to_string())?;
    match zoom_cal.as_ref() {
        Some(engine) => Ok(engine.get_next_trial()),
        None => Err("줌 캘리브레이션이 시작되지 않았습니다".to_string()),
    }
}

/// 줌 트라이얼 결과 제출
#[tauri::command]
pub fn submit_zoom_trial(
    state: State<'_, AppState>,
    params: SubmitZoomTrialParams,
) -> Result<ZoomTrialFeedback, String> {
    let mut zoom_cal = state.zoom_calibration.lock().map_err(|e| e.to_string())?;
    let engine = zoom_cal
        .as_mut()
        .ok_or("줌 캘리브레이션이 시작되지 않았습니다")?;

    let phase = match params.phase.as_str() {
        "steady" => ZoomPhase::Steady,
        "correction" => ZoomPhase::Correction,
        "zoomout" => ZoomPhase::Zoomout,
        _ => return Err(format!("알 수 없는 페이즈: {}", params.phase)),
    };

    Ok(engine.submit_trial(phase, params.score))
}

/// 줌 캘리브레이션 최종 결과 생성
#[tauri::command]
pub fn finalize_zoom_calibration(
    state: State<'_, AppState>,
) -> Result<ZoomCalibrationResult, String> {
    let mut zoom_cal = state.zoom_calibration.lock().map_err(|e| e.to_string())?;
    let engine = zoom_cal
        .as_mut()
        .ok_or("줌 캘리브레이션이 시작되지 않았습니다")?;

    let result = engine.finalize();

    // DB에 결과 저장
    let db = state.db.lock().map_err(|e| e.to_string())?;
    for rr in &result.ratio_results {
        db.insert_zoom_calibration(
            engine.profile_id,
            0, // zoom_profile_id — 이후 매핑 필요
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
        .map_err(|e| e.to_string())?;
    }

    // K 값 저장
    db.insert_multiplier_curve(
        engine.profile_id,
        result.k_fit.k_value,
        Some(result.k_fit.k_variance),
        &serde_json::to_string(&result.k_fit.data_points).unwrap_or_default(),
    )
    .map_err(|e| e.to_string())?;

    // 프로파일 k_value 업데이트
    db.update_profile_k_value(engine.profile_id, result.k_fit.k_value)
        .map_err(|e| e.to_string())?;

    Ok(result)
}

/// K 값 수동 조정
#[tauri::command]
pub fn adjust_k(
    state: State<'_, AppState>,
    delta: f64,
) -> Result<AdjustedPredictions, String> {
    let mut zoom_cal = state.zoom_calibration.lock().map_err(|e| e.to_string())?;
    let engine = zoom_cal
        .as_mut()
        .ok_or("줌 캘리브레이션이 시작되지 않았습니다")?;

    Ok(engine.adjust_k(delta))
}

/// 줌 캘리브레이션 상태 조회
#[tauri::command]
pub fn get_zoom_calibration_status(
    state: State<'_, AppState>,
) -> Result<ZoomCalibrationStatus, String> {
    let zoom_cal = state.zoom_calibration.lock().map_err(|e| e.to_string())?;
    match zoom_cal.as_ref() {
        Some(engine) => Ok(engine.get_status()),
        None => Err("줌 캘리브레이션이 시작되지 않았습니다".to_string()),
    }
}

// ── 비교기 ──

/// 변환 방식 비교기 시작
#[tauri::command]
pub fn start_comparator(
    state: State<'_, AppState>,
    params: StartComparatorParams,
) -> Result<(), String> {
    let engine = ComparatorEngine::new(params.profile_id, params.zoom_profile_id, 3);
    let mut comp = state.comparator.lock().map_err(|e| e.to_string())?;
    *comp = Some(engine);
    Ok(())
}

/// 비교기 다음 트라이얼
#[tauri::command]
pub fn get_next_comparator_trial(
    state: State<'_, AppState>,
    multipliers: Vec<f64>,
) -> Result<Option<super::comparator::ComparatorTrialAction>, String> {
    let comp = state.comparator.lock().map_err(|e| e.to_string())?;
    match comp.as_ref() {
        Some(engine) => Ok(engine.get_next_trial(&multipliers)),
        None => Err("비교기가 시작되지 않았습니다".to_string()),
    }
}

/// 비교기 트라이얼 결과 제출
#[tauri::command]
pub fn submit_comparator_trial(
    state: State<'_, AppState>,
    params: SubmitComparatorParams,
) -> Result<ComparatorTrialFeedback, String> {
    let mut comp = state.comparator.lock().map_err(|e| e.to_string())?;
    let engine = comp
        .as_mut()
        .ok_or("비교기가 시작되지 않았습니다")?;

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
) -> Result<ComparatorResult, String> {
    let comp = state.comparator.lock().map_err(|e| e.to_string())?;
    let engine = comp
        .as_ref()
        .ok_or("비교기가 시작되지 않았습니다")?;

    if !engine.is_complete() {
        return Err("아직 모든 트라이얼이 완료되지 않았습니다".to_string());
    }

    let result = engine.finalize();

    // DB에 결과 저장
    let db = state.db.lock().map_err(|e| e.to_string())?;
    for ms in &result.method_scores {
        db.insert_conversion_comparison(
            engine.profile_id,
            engine.zoom_profile_id,
            &ms.method,
            0.0, // multiplier_used — 이후 매핑
            Some(ms.steady_mean),
            Some(ms.correction_mean),
            Some(ms.zoomout_mean),
            ms.composite_mean,
            ms.p_value,
            ms.effect_size,
            Some(ms.rank as i64),
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(result)
}

// ── 랜드스케이프 ──

/// Performance Landscape 저장
#[tauri::command]
pub fn save_landscape(
    state: State<'_, AppState>,
    params: SaveLandscapeParams,
) -> Result<i64, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.insert_performance_landscape(
        params.profile_id,
        params.calibration_session_id,
        &params.gp_mean_curve,
        &params.confidence_bands,
        &params.scenario_overlays,
        &params.bimodal_peaks,
    )
    .map_err(|e| e.to_string())
}

// ── 헬퍼 ──

/// DB 행을 ZoomProfileInfo로 변환
fn row_to_profile_info(row: &ZoomProfileRow, hipfire_fov: f64) -> ZoomProfileInfo {
    // FOV 오버라이드가 있으면 사용, 없으면 비율로 계산
    let scope_fov = row.fov_override.unwrap_or_else(|| {
        // 근사: scope_fov = hipfire_fov / zoom_ratio
        // (정확한 변환은 tan 기반이지만 단순 비율로 근사)
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
